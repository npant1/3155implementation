"""Start a private, disposable development cluster; never touches Postgres.app data."""
import argparse
import os
from pathlib import Path
import secrets
import shutil
import subprocess
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
STATE = ROOT / '.dev'
DATA = STATE / 'postgres'
ENV = ROOT / '.env'
MARKER = STATE / 'created-by-sprint2-database'


def run(command, **kwargs):
    return subprocess.run([str(x) for x in command], check=True, **kwargs)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bin', type=Path, help='Directory containing initdb, pg_ctl, psql')
    parser.add_argument('--stop', action='store_true')
    args = parser.parse_args()
    executable = shutil.which('initdb')
    binaries = args.bin or (Path(executable).parent if executable else Path('/Applications/Postgres.app/Contents/Versions/latest/bin'))
    for name in ['initdb', 'pg_ctl', 'psql']:
        if not (binaries / name).is_file(): parser.error('Install PostgreSQL or pass --bin /path/to/postgresql/bin')
    if args.stop:
        if not MARKER.exists(): parser.error('No cluster owned by this project was found')
        run([binaries / 'pg_ctl', '-D', DATA, '-m', 'fast', 'stop'])
        return
    STATE.mkdir(mode=0o700, exist_ok=True)
    if not MARKER.exists():
        if ENV.exists() or DATA.exists(): parser.error('Existing .env or cluster found. Configure manually; refusing to overwrite.')
        password = secrets.token_urlsafe(32)
        pwfile = STATE / 'init-password'
        pwfile.write_text(password + '\n')
        pwfile.chmod(0o600)
        try:
            run([binaries / 'initdb', '-D', DATA, '-U', 'campus_dev', '--auth=scram-sha-256', '--encoding=UTF8', '--locale=C', '--pwfile', pwfile])
        finally:
            pwfile.unlink(missing_ok=True)
        STATE.joinpath('password').write_text(password)
        STATE.joinpath('password').chmod(0o600)
        ENV.write_text('NODE_ENV=development\n' + '\n'.join(
            f'{key}=postgresql://campus_dev:{quote(password, safe="")}@127.0.0.1:55432/{name}?schema=public'
            for key, name in [('DATABASE_URL', 'campus_dev'), ('TEST_DATABASE_URL', 'campus_test')]) + '\n')
        ENV.chmod(0o600)
        MARKER.write_text('Isolated local cluster for this checkout, port 55432.\n')
    if not ENV.exists() or not STATE.joinpath('password').exists(): parser.error('Missing local cluster configuration; refusing to guess credentials.')
    status = subprocess.run([str(binaries / 'pg_ctl'), '-D', str(DATA), 'status'], capture_output=True)
    if status.returncode != 0:
        sockets = STATE / 'sockets'
        sockets.mkdir(mode=0o700, exist_ok=True)
        run([binaries / 'pg_ctl', '-D', DATA, '-l', STATE / 'postgres.log', '-o', f'-h 127.0.0.1 -p 55432 -k "{sockets}"', '-w', 'start'])
    env = {**os.environ, 'PGPASSWORD': STATE.joinpath('password').read_text(), 'PGCONNECT_TIMEOUT': '5'}
    psql = [binaries / 'psql', '-h', '127.0.0.1', '-p', '55432', '-U', 'campus_dev', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1']
    for name in ['campus_dev', 'campus_test']:
        result = run(psql + ['-Atc', f"SELECT 1 FROM pg_database WHERE datname = '{name}'"], env=env, capture_output=True, text=True)
        if result.stdout.strip() != '1': run(psql + ['-c', f'CREATE DATABASE {name}'], env=env)
    print('Local PostgreSQL is ready on 127.0.0.1:55432. Credentials are in ignored .env; no existing databases were modified.')


if __name__ == '__main__':
    main()
