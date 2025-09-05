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
  const opts = { branch: 'master', hard: false, force: false, quiet: false, repo: 'https://github.com/Asheblog/Fire-Equipment-Inspection-Management-System.git', depth: 1 };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--branch' && args[i + 1]) { opts.branch = args[++i]; continue; }
    if (a === '--hard') { opts.hard = true; continue; }
    if (a === '--force') { opts.force = true; continue; }
    if (a === '--quiet') { opts.quiet = true; continue; }
    if (a === '--repo' && args[i + 1]) { opts.repo = args[++i]; continue; }
    if (a === '--depth' && args[i + 1]) { opts.depth = parseInt(args[++i], 10) || 1; continue; }
    if (a === '--help' || a === '-h') { printHelp(); process.exit(0); }
    console.warn(`未知参数: ${a}`);
  }
  return opts;
}

function printHelp() {
  console.log(`同步远程到本地脚本\n\n用法: node sync-remote.js [选项]\n\n选项:\n  --branch <name>   指定分支 (默认 master)\n  --repo <url>      仓库地址 (默认 Fire-Equipment ...)\n  --depth <n>       浅获取深度 (默认 1)\n  --hard            使用 hard reset 覆盖\n  --force           忽略未提交修改直接覆盖\n  --quiet           精简输出\n  -h, --help        显示帮助\n\n特性:\n  * 若当前目录不是 git 仓库, 自动初始化并拉取 (--repo / --branch)\n  * 后续再次运行执行增量同步\n`);
}

async function bootstrapRepo(opts, log) {
  log('当前目录不是 git 仓库，执行自举初始化...');
  await run('git init');
  await run(`git remote add origin ${opts.repo}`);
  log(`获取远程分支: ${opts.branch} (depth=${opts.depth})`);
  await run(`git fetch --depth=${opts.depth} origin ${opts.branch}`);
  // 直接检出到工作区（覆盖当前文件，包括本脚本自身拷贝）
  await run(`git checkout -b ${opts.branch} origin/${opts.branch}`);
  await run(`git branch --set-upstream-to=origin/${opts.branch} ${opts.branch}`);
  log('初始化完成。');
}

async function main() {
  const start = Date.now();
  const opts = parseArgs();
  const log = (...m) => { if (!opts.quiet) console.log(...m); };

  try {
    let insideGit = true;
    try {
      await run('git rev-parse --is-inside-work-tree');
    } catch (_) {
      insideGit = false;
    }

    if (!insideGit) {
      await bootstrapRepo(opts, log);
    }
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
