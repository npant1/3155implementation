# Shared database UML

| Diagram | Source | Render |
| --- | --- | --- |
| Implemented entities, attributes, multiplicities and enums | [PlantUML](shared-data-class.puml) | [SVG](shared-data-class.svg) |
| Application submission transaction, authorization and failure paths | [PlantUML](application-sequence.puml) | [SVG](application-sequence.svg) |

The class diagram is generated directly from `prisma/schema.prisma`, including
all scalar attributes and declared foreign-key relationships. SQL-only domain
rules are noted in the diagram and documented in [DATABASE.md](../DATABASE.md).
The sequence describes the implemented database transaction and data-access
boundary. Authentication and HTTP integration are outside this database branch.

To regenerate, use Python 3.9+, Java 21+ and the official
[PlantUML 1.2026.10 JAR](https://github.com/plantuml/plantuml/releases/download/v1.2026.10/plantuml.jar)
outside the repository. No Graphviz is needed (the class diagram uses Smetana).

```bash
python3 scripts/generate-uml.py
python3 scripts/render-uml.py --jar /path/to/plantuml.jar
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p 'test_uml.py' -v
```

The renderer verifies the JAR's pinned SHA-256 against the official release
digest, then records source/render hashes in `render-manifest.json`. Commit
both sources, SVGs, and the manifest after changing the schema or sequence.
The tests detect schema/source drift, stale renders, and invalid SVG geometry;
the SQL integration suite validates the actual persistence behavior.
