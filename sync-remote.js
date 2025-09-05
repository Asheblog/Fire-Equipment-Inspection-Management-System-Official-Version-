#!/usr/bin/env node
/**
 * 自动同步远程仓库 origin 上指定分支（默认 master）到当前工作副本。
 * 生产环境使用：检测远程是否有更新并覆盖本地。
 * 流程:
 *  1. git fetch origin <branch>
 *  2. 比较本地 HEAD 与 origin/<branch>
 *  3. 若无变化退出；若有变化列出差异文件
 *  4. 优先 fast-forward；失败或指定 --hard 时执行 hard reset
 *  5. 本地有未提交修改且未加 --force 时阻止覆盖
 *
 * 用法:
 *   node sync-remote.js [--branch master] [--hard] [--force] [--quiet]
 *
 * 退出码:
 *   0 成功（含已是最新）
 *   1 阻止：本地有未提交更改且未 --force
 *   2 运行时 / Git 错误
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(cmd, opts = {}) {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 10 * 1024 * 1024, ...opts }, (err, stdout, stderr) => {
      if (err) {
        err.stderr = stderr;
        err.stdout = stdout;
        return reject(err);
      }
      resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

function parseArgs() {
  const args = process.argv.slice(2);
  const envProtect = process.env.PROTECT_DIRS ? process.env.PROTECT_DIRS.split(',').map(s => s.trim()).filter(Boolean) : [];
  const opts = { branch: 'master', hard: false, force: false, quiet: false, repo: 'https://github.com/Asheblog/Fire-Equipment-Inspection-Management-System-Official-Version-.git', depth: 1, protect: envProtect };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--branch' && args[i + 1]) { opts.branch = args[++i]; continue; }
    if (a === '--hard') { opts.hard = true; continue; }
    if (a === '--force') { opts.force = true; continue; }
    if (a === '--quiet') { opts.quiet = true; continue; }
    if (a === '--protect' && args[i + 1]) {
      const list = args[++i].split(',').map(s => s.trim()).filter(Boolean);
      opts.protect.push(...list);
      continue;
    }
    if (a === '--repo' && args[i + 1]) { opts.repo = args[++i]; continue; }
    if (a === '--depth' && args[i + 1]) { opts.depth = parseInt(args[++i], 10) || 1; continue; }
    if (a === '--help' || a === '-h') { printHelp(); process.exit(0); }
    console.warn(`未知参数: ${a}`);
  }
  // 去重
  opts.protect = Array.from(new Set(opts.protect));
  return opts;
}

function printHelp() {
  console.log(`同步远程到本地脚本\n\n用法: node sync-remote.js [选项]\n\n选项:\n  --branch <name>      指定分支 (默认 master)\n  --repo <url>         仓库地址 (默认 Fire-Equipment ...)\n  --depth <n>          浅获取深度 (默认 1)\n  --protect a,b        保护目录(逗号分隔/可多次, 不覆盖)\n  --hard               使用 hard reset 覆盖\n  --force              忽略未提交修改直接覆盖\n  --quiet              精简输出\n  -h, --help           显示帮助\n\n环境变量: PROTECT_DIRS="data,uploads"  等同于 --protect data,uploads\n特性:\n  * 非 git 目录自动初始化\n  * 支持保护本地数据目录(不被远程覆盖)\n`);
}

function pathExists(p) { try { fs.accessSync(p); return true; } catch { return false; } }

function isDir(p) { try { return fs.statSync(p).isDirectory(); } catch { return false; } }

async function isTracked(relPath) {
  try {
    const { stdout } = await run(`git ls-files -- ${relPath}`);
    return !!stdout.trim();
  } catch { return false; }
}

function copyIfMissing(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!pathExists(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyIfMissing(path.join(src, entry), path.join(dest, entry));
    }
  } else if (stat.isFile()) {
    if (!pathExists(dest)) {
      fs.copyFileSync(src, dest);
    }
  }
}

async function backupProtectedDirs(list, log) {
  const backups = [];
  for (const item of list) {
    const rel = item.replace(/^[\\/]+/, '').replace(/\\+/g, '/');
    if (!pathExists(rel)) continue;
    const tracked = await isTracked(rel);
    if (tracked) {
      log(`⚠ 保护目录 ${rel} 在仓库中被跟踪，跳过保护 (建议加入 .gitignore)`);
      continue;
    }
    const backupName = `.protect-backup-${Date.now()}-${Math.random().toString(16).slice(2)}-${rel.replace(/\//g,'_')}`;
    const backupPath = path.join('.', backupName);
    fs.renameSync(rel, backupPath);
    backups.push({ original: rel, backupPath });
    log(`已临时移走保护目录 ${rel} -> ${backupPath}`);
  }
  return backups;
}

function restoreProtectedDirs(backups, log) {
  for (const b of backups) {
    if (pathExists(b.original)) {
      // 目标存在(远程有该目录)，执行缺失文件合并
      try { copyIfMissing(b.backupPath, b.original); } catch (e) { log(`合并保护目录失败 ${b.original}: ${e.message}`); }
      // 删除备份
      fs.rmSync(b.backupPath, { recursive: true, force: true });
      log(`已合并保护目录: ${b.original}`);
    } else {
      fs.renameSync(b.backupPath, b.original);
      log(`已恢复保护目录: ${b.original}`);
    }
  }
}

async function bootstrapRepo(opts, log) {
  log('当前目录不是完整 git 仓库，执行自举初始化...');
  // 若 .git 已存在但未成功创建分支 (上次失败)，不用再次 init
  let needInit = false;
  try { await run('git rev-parse --is-inside-work-tree'); } catch { needInit = true; }
  if (needInit) {
    await run('git init');
    await run(`git remote add origin ${opts.repo}`);
  } else {
    // 确保远程存在（可能尚未添加）
    try { await run('git remote get-url origin'); } catch { await run(`git remote add origin ${opts.repo}`); }
  }
  log(`获取远程分支: ${opts.branch} (depth=${opts.depth})`);
  await run(`git fetch --depth=${opts.depth} origin ${opts.branch}`);

  let protectBackups = [];
  if (opts.protect && opts.protect.length) {
    protectBackups = await backupProtectedDirs(opts.protect, log);
  }

  // 处理可能与远程同名的本地未跟踪文件（典型就是当前脚本）
  const scriptPath = process.argv[1];
  const scriptName = scriptPath ? scriptPath.split(/[\\/]/).pop() : 'sync-remote.js';
  let backupPath = null;
  try {
    await run(`git cat-file -e origin/${opts.branch}:${scriptName}`);
    // 远程包含该脚本，若本地存在未跟踪文件会阻塞 checkout
    if (fs.existsSync(scriptName)) {
      // 简单判断是否未跟踪：如果 git ls-files 不含它
      let tracked = false;
      try {
        const { stdout: ls } = await run(`git ls-files -- ${scriptName} || true`);
        tracked = !!ls.trim();
      } catch { tracked = false; }
      if (!tracked) {
        backupPath = `${scriptName}.bootstrap-backup-${Date.now()}`;
        fs.renameSync(scriptName, backupPath);
        log(`检测到未跟踪文件 ${scriptName} 将被远程覆盖，已暂存到 ${backupPath}`);
      }
    }
  } catch { /* 远程不存在该脚本，忽略 */ }

  // 尝试检出
  try {
    await run(`git checkout -b ${opts.branch} origin/${opts.branch}`);
  } catch (e) {
    // 如果分支已存在或之前部分成功，尝试强制对齐
    log('标准检出失败，尝试直接创建/切换并重置到远程...');
    try { await run(`git checkout ${opts.branch}`); } catch { await run(`git checkout -b ${opts.branch}`); }
    await run(`git reset --hard origin/${opts.branch}`);
  }
  await run(`git branch --set-upstream-to=origin/${opts.branch} ${opts.branch}`);

  // 如果远程没有脚本但本地有备份，恢复它
  if (backupPath) {
    try {
      await run(`git cat-file -e origin/${opts.branch}:${scriptName}`);
      // 远程有，不恢复（使用远程版本）
      fs.unlinkSync(backupPath); // 删除备份
    } catch {
      // 远程没有，恢复备份
      if (!fs.existsSync(scriptName)) fs.renameSync(backupPath, scriptName);
    }
  }
  if (protectBackups.length) restoreProtectedDirs(protectBackups, log);
  log('初始化完成。');
}

async function main() {
  const start = Date.now();
  const opts = parseArgs();
  const log = (...m) => { if (!opts.quiet) console.log(...m); };

  try {
    let insideGit = true;
    try { await run('git rev-parse --is-inside-work-tree'); } catch { insideGit = false; }
    // 还需判断是否已有 HEAD（有些情况下 init 后未 checkout 会失败）
    if (insideGit) {
      try { await run('git rev-parse HEAD'); } catch { insideGit = false; }
    }
    if (!insideGit) await bootstrapRepo(opts, log);
    const { stdout: repoRoot } = await run('git rev-parse --show-toplevel');
    log(`仓库根目录: ${repoRoot}`);

    const { stdout: currentRef } = await run('git rev-parse --abbrev-ref HEAD');
    log(`当前分支: ${currentRef}`);

    log(`获取远程更新: origin/${opts.branch} ...`);
    await run(`git fetch origin ${opts.branch}`);

    const { stdout: localHash } = await run('git rev-parse HEAD');
    const { stdout: remoteHash } = await run(`git rev-parse origin/${opts.branch}`);

    if (localHash === remoteHash) {
      log('✔ 已是最新，无需更新');
      return process.exit(0);
    }

    let isAncestor = false;
    try {
      await run(`git merge-base --is-ancestor ${localHash} ${remoteHash}`);
      isAncestor = true;
    } catch (_) {
      isAncestor = false;
    }

    const { stdout: dirty } = await run('git status --porcelain');
    if (dirty && !opts.force) {
      console.error('✖ 本地存在未提交修改，已阻止覆盖 (使用 --force 跳过检查)。');
      return process.exit(1);
    }

    const { stdout: diffListRaw } = await run(`git diff --name-status ${localHash} ${remoteHash}`);
    const diffLines = diffListRaw.split('\n').filter(Boolean);
    log(`远程有更新: ${diffLines.length} 个文件变化`);
    if (!opts.quiet) {
      diffLines.slice(0, 40).forEach(l => log('  ' + l));
      if (diffLines.length > 40) log(`  ... 其余 ${diffLines.length - 40} 个文件`);
    }

    let protectBackups = [];
    if (opts.protect && opts.protect.length) {
      protectBackups = await backupProtectedDirs(opts.protect, log);
    }

    if (opts.hard || !isAncestor) {
      log(opts.hard ? '执行 hard reset 覆盖本地...' : '无法 fast-forward，执行 hard reset 覆盖本地...');
      await run(`git reset --hard origin/${opts.branch}`);
    } else {
      try {
        log('尝试 fast-forward...');
        await run(`git merge --ff-only origin/${opts.branch}`);
      } catch (e) {
        log('fast-forward 失败，fallback 到 hard reset...');
        await run(`git reset --hard origin/${opts.branch}`);
      }
    }

    if (protectBackups.length) restoreProtectedDirs(protectBackups, log);

    const duration = ((Date.now() - start) / 1000).toFixed(2);
    log(`✔ 更新完成 (耗时 ${duration}s)`);
    console.log(JSON.stringify({
      updated: true,
      filesChanged: diffLines.length,
      branch: opts.branch,
      before: localHash,
      after: (await run('git rev-parse HEAD')).stdout
    }, null, 2));
    log('现在可以执行服务重启流程。');
    process.exit(0);
  } catch (err) {
    console.error('同步失败:', err.message);
    if (err.stderr) console.error(err.stderr);
    process.exit(2);
  }
}

main();
