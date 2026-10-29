import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const project = `sgei-dev-${createHash('sha256').update(root.toLowerCase()).digest('hex').slice(0, 10)}`;
const action = process.argv[2] ?? 'up';
if (!['up', 'down', 'reset'].includes(action) || (action === 'reset' && process.argv[3] !== '--yes')) {
  console.error('Use: node dev-up.mjs [up|down|reset --yes]');
  process.exit(1);
}
const apiEnvPath = join(root, 'services', 'api', '.env');
const mlEnvPath = join(root, 'services', 'ml', '.env');
const secret = () => randomBytes(24).toString('base64url');

if (action === 'up' && !existsSync(apiEnvPath)) {
  const dbPassword = secret();
  const mlToken = secret();
  const content = [
    `DATABASE_URL="postgresql://sgei:${dbPassword}@db:5432/sgei?schema=public"`,
    'POSTGRES_USER="sgei"',
    `POSTGRES_PASSWORD="${dbPassword}"`,
    'POSTGRES_DB="sgei"',
    `JWT_SECRET="${secret()}"`,
    'ALLOWED_ORIGINS="http://localhost:5173,http://localhost:8081"',
    'PORT=3000',
    'NODE_ENV=development',
    `DEMO_ADMIN_PASSWORD="${secret()}"`,
    `DEMO_COORDENACAO_PASSWORD="${secret()}"`,
    `DEMO_PROFESSOR_PASSWORD="${secret()}"`,
    `DEMO_TUTOR_PASSWORD="${secret()}"`,
    `DEMO_ALUNO_PASSWORD="${secret()}"`,
    'ML_SERVICE_URL="http://ml:8000"',
    `ML_SERVICE_TOKEN="${mlToken}"`,
    'ML_PREVIEW_ENABLED=false',
    '',
  ].join('\n');
  writeFileSync(apiEnvPath, content, { flag: 'wx', mode: 0o600 });
  console.info('Configuração local da API criada em services/api/.env.');
}

const apiEnv = action === 'up' ? readFileSync(apiEnvPath, 'utf8') : '';
const envValue = (key) => {
  const raw = apiEnv.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1]?.trim();
  return raw?.replace(/^(["'])(.*)\1$/, '$2') ?? '';
};
for (const key of action === 'up' ? [
  'DATABASE_URL',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'POSTGRES_DB',
  'JWT_SECRET',
  'DEMO_ADMIN_PASSWORD',
  'DEMO_COORDENACAO_PASSWORD',
  'DEMO_PROFESSOR_PASSWORD',
  'DEMO_TUTOR_PASSWORD',
  'DEMO_ALUNO_PASSWORD',
] : []) {
  if (!envValue(key)) {
    console.error(`Defina ${key} em services/api/.env antes de iniciar.`);
    process.exit(1);
  }
}

if (action === 'up') {
  const passwords = ['ADMIN', 'COORDENACAO', 'PROFESSOR', 'TUTOR', 'ALUNO']
    .map((profile) => envValue(`DEMO_${profile}_PASSWORD`));
  let validDatabase = false;
  try {
    const url = new URL(envValue('DATABASE_URL'));
    validDatabase = url.hostname === 'db' &&
      decodeURIComponent(url.username) === envValue('POSTGRES_USER') &&
      decodeURIComponent(url.password) === envValue('POSTGRES_PASSWORD') &&
      url.pathname.slice(1) === envValue('POSTGRES_DB');
  } catch { /* A configuração será recusada abaixo. */ }
  if (
    envValue('NODE_ENV') === 'production' ||
    !validDatabase ||
    envValue('POSTGRES_PASSWORD') === 'troque-a-senha' ||
    envValue('JWT_SECRET').startsWith('gere-um-segredo') ||
    passwords.some((password) => password.length < 12 || password.length > 128) ||
    new Set(passwords).size !== passwords.length
  ) {
    console.error('Configure segredos locais distintos e DATABASE_URL para o serviço Docker db em services/api/.env.');
    process.exit(1);
  }
}

if (action === 'up' && !existsSync(mlEnvPath)) {
  const match = apiEnv.match(/^ML_SERVICE_TOKEN=["']?([^\s"']+)/m);
  const token = match?.[1] ?? secret();
  writeFileSync(mlEnvPath, `ML_SERVICE_TOKEN="${token}"\nML_MODEL_APPROVED_SHA256=""\n`, {
    flag: 'wx',
    mode: 0o600,
  });
  console.info('Configuração local de ML criada em services/ml/.env.');
}

const composeArgs = [
  'compose', '--project-name', project,
  '-f', 'docker-compose.yml', '-f', 'compose.dev.yml',
];
const command = spawnSync('docker', [
  ...composeArgs,
  ...(action === 'up' ? ['up', '-d', '--build', 'api'] : ['down', ...(action === 'reset' ? ['--volumes'] : [])]),
], { cwd: root, stdio: 'inherit' });
if (command.error) {
  console.error('Não foi possível executar Docker Compose.');
  process.exit(1);
}
process.exit(command.status ?? 1);
