# UML diagrams

| Diagram | Source | Render |
| --- | --- | --- |
| Complete shared database model | [PlantUML](shared-data-class.puml) | [SVG](shared-data-class.svg) |
| Messaging send/history flow | [PlantUML](messaging-sequence.puml) | [SVG](messaging-sequence.svg) |
| Shared application submission data-access flow | [PlantUML](application-sequence.puml) | [SVG](application-sequence.svg) |

Use Python 3.9+, Java 21+ and the official
[PlantUML 1.2026.10 JAR](https://github.com/plantuml/plantuml/releases/download/v1.2026.10/plantuml.jar)
outside the repository. The render scripts verify its pinned checksum.
Smetana handles class layouts; Graphviz is unnecessary.

```bash
python3 scripts/generate-uml.py
python3 scripts/render-uml.py --jar /path/to/plantuml.jar
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p 'test*uml.py' -v
```

`render-manifest.json` records the source/render hashes. Commit the sources,
SVGs and manifest together. Checks detect Prisma/schema drift and stale
renders. See [database setup](../DATABASE.md) and [messaging behavior](../MESSAGING.md).
