import type {
    DetectedPortResults,
    RunBunCommandOptions,
    RunBunCommandResult,
} from '@onlook/models';
import { exec } from 'child_process';
import { detect } from 'detect-port';
import { app } from 'electron';
import path from 'path';
import { promisify } from 'util';
import { __dirname } from '../index';
import { PersistentStorage } from '../storage';
import { getShellCommand, isWSL, detectUserShell } from '../utils/platform';
import { replaceCommand } from './parse';

const execAsync = promisify(exec);

export const getBunExecutablePath = (): string => {
    const arch = process.arch === 'arm64' ? 'aarch64' : process.arch;
    const isProduction = app.isPackaged;
    const binName = process.platform === 'win32' ? `bun.exe` : `bun-${arch}`;

    const bunPath = isProduction
        ? path.join(process.resourcesPath, 'bun', binName)
        : path.join(__dirname, 'resources', 'bun', binName);

    return bunPath;
};

export async function runBunCommand(
    command: string,
    options: RunBunCommandOptions,
): Promise<RunBunCommandResult> {
    try {
        const commandToExecute = getBunCommand(command);

        // Get user's shell preference from settings
        const userSettings = PersistentStorage.USER_SETTINGS.read();
        const userShellPreference = userSettings?.editor?.shellType;

        // Use the shared shell detection function with user preference
        const shell = getShellCommand(userShellPreference);
        const detectedShell = detectUserShell();

        console.log(`Executing command: ${commandToExecute}`);
        console.log(
            `  Shell: ${shell}, WSL: ${isWSL()}, User Preference: ${userShellPreference || 'auto-detect'}, Detected: ${detectedShell}`,
            options.cwd,
        );
        const { stdout, stderr } = await execAsync(commandToExecute, {
            cwd: options.cwd,
            maxBuffer: 1024 * 1024 * 10,
            env: options.env,
            shell,
        });

        console.log('Command executed with output: ', stdout);
        return { success: true, output: stdout.toString(), error: stderr.toString() };
    } catch (error) {
        console.error(error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

export const getBunCommand = (command: string): string => {
    const userSettings = PersistentStorage.USER_SETTINGS.read() || {};
    const enableBunReplace = userSettings.editor?.enableBunReplace !== false;

    if (!enableBunReplace) {
        return command;
    }

    const bunExecutable = getBunExecutablePath();
    return replaceCommand(command, bunExecutable);
};
