"""Verify the UML matches the committed Prisma schema and renders are current."""
import hashlib
import importlib.util
import json
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
UML = ROOT / 'docs/uml'
spec = importlib.util.spec_from_file_location('generator', ROOT / 'scripts/generate-uml.py')
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)


class SharedUmlTests(unittest.TestCase):
    def test_class_diagram_tracks_schema(self):
        self.assertEqual((UML / 'shared-data-class.puml').read_text(), generator.generate(),
                         'Regenerate class diagram after changing the Prisma schema')

    def test_rendered_artifacts_are_current_and_valid(self):
        manifest = json.loads((UML / 'render-manifest.json').read_text())
        self.assertEqual(set(manifest['artifacts']), {'shared-data-class.puml', 'application-sequence.puml', 'messaging-sequence.puml'})
        for name, hashes in manifest['artifacts'].items():
            with self.subTest(diagram=name):
                source = UML / name
                svg = source.with_suffix('.svg')
                self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(), hashes['source_sha256'])
                self.assertEqual(hashlib.sha256(svg.read_bytes()).hexdigest(), hashes['svg_sha256'])
                root = ET.parse(svg).getroot()
                self.assertEqual(root.tag, '{http://www.w3.org/2000/svg}svg')
                self.assertNotIn('Syntax Error', ' '.join(root.itertext()))
                self.assertGreater(float(root.attrib['width'].removesuffix('px')), 0)
                self.assertGreater(float(root.attrib['height'].removesuffix('px')), 0)


if __name__ == '__main__':
    unittest.main()
