import * as assert from 'assert';
import * as vscode from 'vscode';
import { JenkinsService } from '../src/services/jenkins-service';
import { GitService } from '../src/services/git-service';

suite('Extension Test Suite', () => {
    test('Jenkins Service Configuration Test', () => {
        const jenkinsService = new JenkinsService();
        assert.strictEqual(typeof (jenkinsService as any).config, 'object');
    });

    test('Git Service Initialization Test', () => {
        const gitService = new GitService();
        assert.strictEqual(typeof (gitService as any).git, 'object');
    });

    test('Extension Activation Test', async () => {
        const ext = vscode.extensions.getExtension('jenkins-build-status');
        assert.strictEqual(ext !== undefined, true);
        
        if (ext) {
            await ext.activate();
            assert.strictEqual(ext.isActive, true);
        }
    });
});