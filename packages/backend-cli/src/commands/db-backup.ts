import inquirer from 'inquirer';
import fs from 'node:fs';
import path from 'node:path';
import { executePgDump, testPgConnection, formatBackupTimestamp, sanitizeHostIdentifier } from '../utils/pg-runner.js';
import {
  getDatabaseConfig,
  getAvailableDatabaseSecrets,
  isLocalHost,
  loadDatabaseSecret,
} from '../utils/database-connection.js';

export interface DbBackupOptions {
  source?: 'local' | 'remote';
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  output?: string;
  nonInteractive?: boolean;
  secret?: string;
  provider?: 'file' | 'gsm' | 'aws';
}

export async function dbBackup(options?: DbBackupOptions): Promise<void> {
  const config = getDatabaseConfig();
  const targetDb = options?.database || config.database;

  console.log('============================================================');
  console.log('  Database Backup Utility' + (targetDb ? ` [Database: ${targetDb}]` : ''));
  console.log('  (PostgreSQL Dump with Compressed Custom Format -Fc)       ');
  console.log('============================================================\n');

  try {
    let host = options?.host;
    let port = options?.port;
    let database = options?.database;
    let user = options?.user;
    let password = options?.password;

    // 1. Resolve from --secret if explicitly passed
    if (options?.secret) {
      const creds = loadDatabaseSecret(options.secret, options.provider || 'file');
      host = host || creds.host;
      port = port || creds.port;
      database = database || creds.database;
      user = user || creds.user;
      password = password || creds.password;
      console.log(`🔐 Credentials loaded from secret "${creds.secretName}" [provider: ${options.provider || 'file'}]${creds.envKey ? ` (via .env ${creds.envKey})` : ''} [${user}@${host}:${port}/${database}]`);
    }

    // 2. Interactive selection if credentials not fully supplied
    if (!host || !database || !user || !password) {
      if (!options?.nonInteractive) {
        const availableEnvSecrets = getAvailableDatabaseSecrets();
        const envOwnerSecret = process.env['DB_OWNER_SECRET_NAME'];

        const choices = [];
        if (availableEnvSecrets.length === 1) {
          choices.push({
            name: `1. Database from .env (${availableEnvSecrets[0].secretName})`,
            value: `env_secret:${availableEnvSecrets[0].secretName}`,
          });
        } else if (availableEnvSecrets.length > 1) {
          choices.push({
            name: `1. Database from .env (${availableEnvSecrets[0].secretName} or others configured in .env)`,
            value: 'select_env_secret',
          });
        } else if (envOwnerSecret) {
          choices.push({
            name: `1. Active database from .env (DB_OWNER_SECRET_NAME: ${envOwnerSecret})`,
            value: `env_secret:${envOwnerSecret}`,
          });
        }

        choices.push({
          name: '2. Enter secret name (Default: file [./secrets, /run/secrets], or gsm / aws for cloud)',
          value: 'prompt_secret',
        });
        choices.push({
          name: '3. Select secret from local directory (./secrets or /run/secrets)',
          value: 'select_file',
        });
        choices.push({
          name: '4. Manual connection parameters (enter host, port, database, user, password)',
          value: 'manual',
        });

        const answer = await inquirer.prompt<{ action: string }>([
          {
            type: 'list',
            name: 'action',
            message: 'Select database / credentials source for backup:',
            choices,
            default: choices[0]?.value,
          },
        ]);

        if (answer.action.startsWith('env_secret:')) {
          const secretName = answer.action.replace('env_secret:', '');
          const creds = loadDatabaseSecret(secretName, options?.provider || 'file');
          host = host || creds.host;
          port = port || creds.port;
          database = database || creds.database;
          user = user || creds.user;
          password = password || creds.password;
          console.log(`🔐 Credentials loaded from .env secret "${creds.secretName}" [${user}@${host}:${port}/${database}]`);
        } else if (answer.action === 'select_env_secret') {
          const envSecretAnswer = await inquirer.prompt<{ secretName: string }>([
            {
              type: 'list',
              name: 'secretName',
              message: 'Select database secret configured in .env:',
              choices: availableEnvSecrets.map((s) => ({
                name: `${s.label}`,
                value: s.secretName,
              })),
            },
          ]);
          const creds = loadDatabaseSecret(envSecretAnswer.secretName, options?.provider || 'file');
          host = host || creds.host;
          port = port || creds.port;
          database = database || creds.database;
          user = user || creds.user;
          password = password || creds.password;
          console.log(`🔐 Credentials loaded from .env secret "${creds.secretName}" [${user}@${host}:${port}/${database}]`);
        } else if (answer.action === 'prompt_secret') {
          const secretAnswer = await inquirer.prompt<{ secretName: string }>([
            {
              type: 'input',
              name: 'secretName',
              message: 'Enter secret name (e.g. openclinic-prod-owner-postgres-credentials, database-secret-owner):',
              validate: (v: string) => v.trim().length > 0 || 'Secret name is required.',
            },
          ]);

          const providerAnswer = await inquirer.prompt<{ provider: 'file' | 'gsm' | 'aws' }>([
            {
              type: 'list',
              name: 'provider',
              message: 'Select secrets provider (Default: file):',
              choices: [
                {
                  name: 'file (Default: local ./secrets or Docker /run/secrets)',
                  value: 'file',
                },
                {
                  name: 'gsm (Google Cloud Secret Manager)',
                  value: 'gsm',
                },
                {
                  name: 'aws (AWS Secrets Manager)',
                  value: 'aws',
                },
              ],
              default: (process.env['SECRETS_PROVIDER'] as 'file' | 'gsm' | 'aws') || 'file',
            },
          ]);

          const creds = loadDatabaseSecret(secretAnswer.secretName, providerAnswer.provider);
          host = host || creds.host;
          port = port || creds.port;
          database = database || creds.database;
          user = user || creds.user;
          password = password || creds.password;
          console.log(`🔐 Credentials loaded from secret "${creds.secretName}" [provider: ${providerAnswer.provider}] [${user}@${host}:${port}/${database}]`);
        } else if (answer.action === 'select_file') {
          const searchDirs = [
            path.resolve(process.cwd(), process.env['SECRETS_DIR'] || 'secrets'),
            '/run/secrets',
            path.resolve(process.cwd(), '../secrets'),
          ];
          const discoveredFiles: Array<{ name: string; fullPath: string }> = [];
          for (const dir of searchDirs) {
            if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
              const dirFiles = fs.readdirSync(dir)
                .filter((f) => (f.endsWith('.json') || f.endsWith('.txt')) && !f.includes('.example.'));
              for (const f of dirFiles) {
                discoveredFiles.push({
                  name: `${f} [${dir}]`,
                  fullPath: path.join(dir, f),
                });
              }
            }
          }

          if (!discoveredFiles.length) {
            throw new Error('No secret files (.json, .txt) found in ./secrets or /run/secrets.');
          }

          const fileAnswer = await inquirer.prompt<{ file: string }>([
            {
              type: 'list',
              name: 'file',
              message: 'Select secret file:',
              choices: discoveredFiles.map((df) => ({
                name: df.name,
                value: df.fullPath,
              })),
            },
          ]);
          const creds = loadDatabaseSecret(fileAnswer.file, 'file');
          host = host || creds.host;
          port = port || creds.port;
          database = database || creds.database;
          user = user || creds.user;
          password = password || creds.password;
          console.log(`🔐 Credentials loaded from file "${fileAnswer.file}" [${user}@${host}:${port}/${database}]`);
        }
      }
    }

    // Fallbacks if still not set
    host = host || options?.host || config.host;
    port = port || options?.port || config.port;
    database = database || options?.database || config.database;
    const isLocal = isLocalHost(host);

    if (isLocal) {
      if (!user) {
        if (options?.nonInteractive) {
          user = config.ownerUser || config.appUser || undefined;
        } else {
          const userPrompt = await inquirer.prompt<{ user: string }>([
            {
              type: 'input',
              name: 'user',
              message: 'PostgreSQL backup username:',
              default: config.ownerUser || config.appUser || undefined,
              validate: (v: string) => v.trim().length > 0 || 'Username is required.',
            },
          ]);
          user = userPrompt.user.trim();
        }
      }

      if (!password) {
        const defaultPass = (user === config.appUser ? config.appPassword : config.ownerPassword) || undefined;
        if (!defaultPass && !options?.nonInteractive) {
          const passAnswer = await inquirer.prompt<{ password: string }>([
            {
              type: 'password',
              name: 'password',
              message: `Password for user ${user}:`,
              mask: '*',
              validate: (v: string) => v.length > 0 || 'Password is required.',
            },
          ]);
          password = passAnswer.password;
        } else {
          password = defaultPass;
        }
      }
    } else {
      if (!host || !user || !password) {
        console.log('\nEnter remote server connection settings:');
        const remoteAnswers = await inquirer.prompt([
          {
            type: 'input',
            name: 'host',
            message: 'Remote server host / IP:',
            default: host || process.env['REMOTE_DB_HOST'] || '',
            validate: (v: string) => v.trim().length > 0 || 'Host is required.',
            when: !host,
          },
          {
            type: 'input',
            name: 'port',
            message: 'PostgreSQL port:',
            default: String(port),
            validate: (v: string) => !isNaN(parseInt(v, 10)) || 'Invalid port.',
            when: !port,
          },
          {
            type: 'input',
            name: 'database',
            message: 'Database name:',
            default: database,
            validate: (v: string) => v.trim().length > 0 || 'Database name is required.',
            when: !database,
          },
          {
            type: 'input',
            name: 'user',
            message: 'User (owner or DDL-privileged role):',
            default: user || config.ownerUser || undefined,
            validate: (v: string) => v.trim().length > 0 || 'User is required.',
            when: !user,
          },
          {
            type: 'password',
            name: 'password',
            message: 'User password:',
            mask: '*',
            validate: (v: string) => v.length > 0 || 'Password is required.',
            when: !password,
          },
        ]);

        host = (host || remoteAnswers.host || '').trim();
        port = port || parseInt(String(remoteAnswers.port || config.port).trim(), 10);
        database = (database || remoteAnswers.database || '').trim();
        user = (user || remoteAnswers.user || '').trim();
        password = password || remoteAnswers.password;
      }
    }

    const finalHost = host || config.host || 'localhost';
    const finalPort = port || config.port || 5432;
    const finalDatabase = database || config.database;
    const finalUser = user;

    if (!finalUser) throw new Error('PostgreSQL user is required.');
    if (!finalDatabase) throw new Error('Database name is required.');

    // 2. Output file path
    let outputPath = options?.output;
    if (!outputPath) {
      const hostTag = sanitizeHostIdentifier(finalHost);
      const timestamp = formatBackupTimestamp();
      const defaultFilename = `${finalDatabase}_${hostTag}_${timestamp}.dump`;
      const defaultPath = path.join('backups', defaultFilename);

      if (options?.nonInteractive) {
        outputPath = defaultPath;
      } else {
        const answer = await inquirer.prompt<{ outputPath: string }>([
          {
            type: 'input',
            name: 'outputPath',
            message: 'Output backup file path:',
            default: defaultPath,
            validate: (v: string) => v.trim().length > 0 || 'Output path is required.',
          },
        ]);
        outputPath = answer.outputPath.trim();
      }
    }

    // 3. Test Connection
    console.log('\n[1/2] Testing database connectivity...');
    const connTest = await testPgConnection({ host: finalHost, port: finalPort, database: finalDatabase, user: finalUser, password });
    if (!connTest.success) {
      console.error(`❌ [ERROR] Could not connect to database: ${connTest.error}`);
      process.exit(1);
    }
    console.log('  [OK] Connection established successfully.');

    // 4. Execute Backup
    console.log(`\n[2/2] Generating full dump of database "${finalDatabase}"...`);
    console.log(`  Output file: ${path.resolve(outputPath)}`);

    const startTime = Date.now();
    await executePgDump({
      host: finalHost,
      port: finalPort,
      database: finalDatabase,
      user: finalUser,
      password,
      outputPath,
      isLocal,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const stats = fs.existsSync(outputPath) ? fs.statSync(outputPath) : null;
    const sizeMb = stats ? (stats.size / (1024 * 1024)).toFixed(2) : '0';

    console.log('\n============================================================');
    console.log('  ✅ Backup completed successfully!');
    console.log(`  File: ${outputPath}`);
    console.log(`  Size: ${sizeMb} MB (${stats?.size ?? 0} bytes)`);
    console.log(`  Elapsed: ${elapsed}s`);
    console.log('============================================================\n');
  } catch (error) {
    console.error('\n❌ [CRITICAL ERROR] Backup execution failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
