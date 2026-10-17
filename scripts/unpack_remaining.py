import tarfile
import os
import shutil

base_nm = r'D:\fraud detection\frontend_clean\node_modules'
src_dir = r'D:\fraud detection\test-py-next'

pkgs = {
    'lucide-react': 'lucide.tgz',
    'tailwindcss': 'tailwindcss.tgz',
    'autoprefixer': 'autoprefixer.tgz',
    'typescript': 'typescript.tgz'
}

for name, tgz_name in pkgs.items():
    dest = os.path.join(base_nm, name)
    os.makedirs(dest, exist_ok=True)
    tgz_path = os.path.join(src_dir, tgz_name)
    print(f'Unpacking {name}...')
    with tarfile.open(tgz_path, 'r:gz') as tar:
        for m in tar.getmembers():
            if m.name.startswith('package/'):
                m.name = m.name[len('package/'):]
                target_path = os.path.join(dest, m.name)
                # Ensure parent directory exists
                if m.isdir():
                    os.makedirs(target_path, exist_ok=True)
                    continue
                os.makedirs(os.path.dirname(target_path), exist_ok=True)
                for attempt in range(5):
                    try:
                        f_in = tar.extractfile(m)
                        if f_in:
                            with open(target_path, 'wb') as f_out:
                                shutil.copyfileobj(f_in, f_out)
                        break
                    except (PermissionError, OSError):
                        import time
                        time.sleep(0.15)

    print(f'OK: {name}')

bin_dir = os.path.join(base_nm, '.bin')
os.makedirs(bin_dir, exist_ok=True)

with open(os.path.join(bin_dir, 'next.cmd'), 'w', encoding='utf-8') as f:
    f.write('@ECHO off\r\nnode "%~dp0\\..\\next\\dist\\bin\\next" %*\r\n')

with open(os.path.join(bin_dir, 'tailwindcss.cmd'), 'w', encoding='utf-8') as f:
    f.write('@ECHO off\r\nnode "%~dp0\\..\\tailwindcss\\lib\\cli.js" %*\r\n')

with open(os.path.join(bin_dir, 'tsc.cmd'), 'w', encoding='utf-8') as f:
    f.write('@ECHO off\r\nnode "%~dp0\\..\\typescript\\bin\\tsc" %*\r\n')

print('All 4 packages unpacked and .bin created!')
