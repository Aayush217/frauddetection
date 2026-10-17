import urllib.request
import tarfile
import shutil
import os
import json

node_modules = r'D:\fraud detection\frontend_clean\node_modules'
os.makedirs(node_modules, exist_ok=True)

# 1. Copy next from test-py-next/package
next_dest = os.path.join(node_modules, 'next')
if os.path.exists(next_dest):
    shutil.rmtree(next_dest)
print('Copying next...')
shutil.copytree(r'D:\fraud detection\test-py-next\package', next_dest)
print('Next copied!')

# 2. Download and unpack remaining packages
packages = {
    'lucide-react': 'https://registry.npmjs.org/lucide-react/-/lucide-react-0.475.0.tgz',
    'tailwindcss': 'https://registry.npmjs.org/tailwindcss/-/tailwindcss-3.4.17.tgz',
    'autoprefixer': 'https://registry.npmjs.org/autoprefixer/-/autoprefixer-10.4.20.tgz',
    'typescript': 'https://registry.npmjs.org/typescript/-/typescript-5.7.3.tgz',
}

tmp_dir = r'D:\fraud detection\test-py-next\tmp'
os.makedirs(tmp_dir, exist_ok=True)

for name, url in packages.items():
    print(f'Fetching {name}...')
    tgz = os.path.join(tmp_dir, f'{name}.tgz')
    if not os.path.exists(tgz):
        urllib.request.urlretrieve(url, tgz)
    dest = os.path.join(node_modules, name)
    if os.path.exists(dest):
        shutil.rmtree(dest)
    os.makedirs(dest, exist_ok=True)
    with tarfile.open(tgz, 'r:gz') as tar:
        for member in tar.getmembers():
            if member.name.startswith('package/'):
                member.name = member.name[len('package/'):]
                tar.extract(member, path=dest)
    print(f'Extracted {name} to {dest}')

# 3. Create .bin wrappers
bin_dir = os.path.join(node_modules, '.bin')
os.makedirs(bin_dir, exist_ok=True)

def make_bin(cmd_name, target_rel):
    with open(os.path.join(bin_dir, f'{cmd_name}.cmd'), 'w', encoding='utf-8') as f:
        f.write(f'@ECHO off\r\nnode "%~dp0\\..\\{target_rel}" %*\r\n')
    with open(os.path.join(bin_dir, cmd_name), 'w', encoding='utf-8') as f:
        f.write(f'#!/bin/sh\r\nexec node "$(dirname "$0")/../{target_rel}" "$@"\r\n')

make_bin('next', os.path.join('next', 'dist', 'bin', 'next'))
make_bin('tailwindcss', os.path.join('tailwindcss', 'lib', 'cli.js'))
make_bin('tsc', os.path.join('typescript', 'bin', 'tsc'))

print('All frontend dependencies configured successfully!')
