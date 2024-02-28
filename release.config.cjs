const { execSync } = require('child_process');

const plugins =  [
    // [
    //     '@semantic-release/exec',
    //     {
    //         prepareCmd: "echo 'next release version=${nextRelease.version} (test)'",
    //     },
    // ],
    [
        'semantic-release-unsquash',
        {
            commitAnalyzerConfig: {
                preset: 'conventionalcommits',
                parserOpts: {
                    noteKeywords: ['BREAKING CHANGE', 'BREAKING CHANGES', 'BREAKING'],
                },
                releaseRules: [
                    { type: "hotfix", release: "patch" },
                    { type: "docs", release: "patch" },
                    { type: "refactor", release: "patch" },
                    { type: "perf", release: "patch" },
                    { type: "ci", release: "patch" },
                    { type: "chore", release: "patch" },
                    { type: "test", release: "patch" },
                ],
            },
            notesGeneratorConfig: {
                preset: 'conventionalcommits',
                parserOpts: {
                    noteKeywords: ['BREAKING CHANGE', 'BREAKING CHANGES', 'BREAKING'],
                },
                writerOpts: {
                    commitsSort: ['subject', 'scope'],
                },
                presetConfig: {
                    types: [
                        { type: "feat", section: "Features" },
                        { type: "chore", section: "Chores" },
                        { type: "fix", section: "Bug Fixes" },
                        { type: "hotfix", section: "Bug Fixes" },
                        { type: "docs", section: "Docs" },
                        { type: "refactor", section: "Refactoring" },
                        { type: "perf", section: "Performance Improvements" },
                        { type: "ci", section: "CI/CD Changes" },
                        { type: "test", section: "Tests" },
                    ]
                }
            },
        },
    ],
    [
        '@semantic-release/changelog',
        {
            changelogFile: 'CHANGELOG.md',
        },
    ],
    [
        '@semantic-release/npm',
        {
            npmPublish: true,
        },
    ],
    // [
    //     "@semantic-release/git",
    //     {
    //         "assets": ["CHANGELOG.md"]
    //     }
    // ]
]

module.exports = isDryRun() ? getDryRunConfig() : getCIConfig();

function getDryRunConfig() {
    return {
        repositoryUrl: getLocalRepoUrl(),
        branches: [getCurrentBranch()],
        plugins
    };
}

function getCIConfig() {
    return {
        repositoryUrl: 'https://github.com/tak-bro/aicommit2',
        branches: ['main'],
        plugins
    };
}

function isDryRun() {
    return process.argv.includes('--dry-run');
}

function getLocalRepoUrl() {
    const topLevelDir = execSync('git rev-parse --show-toplevel').toString().trim();

    return `file://${topLevelDir}/.git`;
}

function getCurrentBranch() {
    return execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
}
