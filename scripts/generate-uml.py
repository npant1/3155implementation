"""Generate the shared class diagram directly from prisma/schema.prisma."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = ROOT / 'prisma/schema.prisma'
TARGET = ROOT / 'docs/uml/shared-data-class.puml'


def generate():
    schema = SCHEMA.read_text()
    models = dict(re.findall(r'^model (\w+) \{\n(.*?)^\}', schema, re.M | re.S))
    enums = dict(re.findall(r'^enum (\w+) \{\n(.*?)^\}', schema, re.M | re.S))
    lines = ['@startuml', '!pragma layout smetana', 'skinparam classAttributeIconSize 0',
             'skinparam shadowing false', 'skinparam backgroundColor white',
             'hide methods', 'top to bottom direction',
             'title Norms Gold Pan — implemented shared PostgreSQL data model']
    edges = []
    for name, body in models.items():
        lines.append(f'class {name} {{')
        fields = re.findall(r'^\s+(\w+)\s+(\w+(?:\[\]|\?)?)(.*)$', body, re.M)
        unique_fields = {field for field, _, attrs in fields if '@id' in attrs or '@unique' in attrs}
        all_fks = {key.strip() for group in re.findall(r'fields:\s*\[([^\]]+)\]', body) for key in group.split(',')}
        for field, kind, attrs in fields:
            base = kind.replace('[]', '').replace('?', '')
            if base in models:
                if 'fields:' in attrs:
                    fk = re.search(r'fields:\s*\[([^\]]+)\]', attrs)
                    assert fk is not None
                    foreign_keys = [f.strip() for f in fk[1].split(',')]
                    source_count = '0..1' if any(f in unique_fields for f in foreign_keys) else '0..*'
                    target_count = '0..1' if kind.endswith('?') else '1'
                    edges.append(f'{name} "{source_count}" --> "{target_count}" {base} : {field}')
                continue
            flags = []
            if '@id' in attrs: flags.append('PK')
            if field in all_fks: flags.append('FK')
            if '@unique' in attrs: flags.append('unique')
            suffix = ' {' + ', '.join(flags) + '}' if flags else ''
            display_type = ('UUID?' if kind.endswith('?') else 'UUID') if '@db.Uuid' in attrs else kind
            lines.append(f'  +{field}: {display_type}{suffix}')
        lines.append('}')
    for name, body in enums.items():
        lines.extend([f'enum {name} {{', *['  '+v.strip() for v in body.splitlines() if v.strip()], '}'])
    lines += edges
    lines += ['note as Constraints',
              'SQL migrations additionally enforce roles, file purposes/ownership,',
              'publication completeness, unique applications, denial reasons,',
              'immutable message senders, and profile version increments.',
              'Account authentication and object-storage bytes are external.',
              'OpportunityResearchArea has a composite primary key.',
              'Application and Conversation have composite unique pairs.',
              'Message has a unique sender/clientMessageId retry key.',
              'end note', '@enduml', '']
    return '\n'.join(lines)


if __name__ == '__main__':
    TARGET.write_text(generate())
    print('Generated shared-data-class.puml from Prisma schema.')
