"""Render shared database diagrams using a verified PlantUML JAR."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
UML = ROOT / 'docs' / 'uml'
VERSION = '1.2026.10'
JAR_SHA256 = 'e9bc9e6b2eb715e8c0c929f3dcb5fc1923be13f37599b09c293c66d354e88686'
SOURCES = ('shared-data-class.puml', 'application-sequence.puml', 'messaging-sequence.puml')


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--jar', required=True, type=Path)
    args = parser.parse_args()
    jar = args.jar.resolve()
    if digest(jar) != JAR_SHA256:
        parser.error('PlantUML JAR does not match the verified release checksum')
    subprocess.run([
        'java', '-Djava.awt.headless=true', '-jar', str(jar),
        '-failfast2', '-tsvg', *[str(UML / name) for name in SOURCES],
    ], check=True, cwd=ROOT)
    artifacts = {}
    for name in SOURCES:
        source = UML / name
        rendered = source.with_suffix('.svg')
        root = ET.parse(rendered).getroot()
        if root.tag != '{http://www.w3.org/2000/svg}svg':
            raise ValueError(f'{rendered.name} is not SVG')
        if 'Syntax Error' in rendered.read_text():
            raise ValueError(f'{rendered.name} contains a renderer error')
        artifacts[name] = {'source_sha256': digest(source),
                           'svg_sha256': digest(rendered)}
    (UML / 'render-manifest.json').write_text(
        json.dumps({'plantuml_version': VERSION, 'jar_sha256': JAR_SHA256,
                    'artifacts': artifacts}, indent=2) + '\n')
    print('Rendered shared database and messaging diagrams and recorded checksums.')


if __name__ == '__main__':
    main()
