const { execSync } = require('child_process');

const plugins =  [
    ["semantic-release-unsquash", {
        "commitAnalyzerConfig": {
            "preset": "angular",
            "parserOpts": {
                "noteKeywords": ["BREAKING CHANGE", "BREAKING CHANGES", "BREAKING"]
            }
        },
        "notesGeneratorConfig": {
            "preset": "angular",
            "parserOpts": {
                "noteKeywords": ["BREAKING CHANGE", "BREAKING CHANGES", "BREAKING"]
            },
            "writerOpts": {
                "commitsSort": ["subject", "scope"]
            }
        }
    }],
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
