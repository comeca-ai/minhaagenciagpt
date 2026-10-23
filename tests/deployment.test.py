"""Exercise the real installer against a controlled Docker command double."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
HASH = "$2a$14$" + "A" * 53


class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="jhoneme-test-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for name in ("install.sh", "manage.sh", "scripts", "deploy", "Dockerfile",
                     "compose.yaml", "compose.local.yaml", "compose.https.yaml"):
            src, dst = ROOT / name, self.root / name
            shutil.copytree(src, dst) if src.is_dir() else shutil.copy(src, dst)
        (self.root / "dist").mkdir()
        (self.root / "dist/index.html").write_text("Jhoneme")
        (self.root / "bin").mkdir()
        docker = self.root / "bin/docker"
        docker.write_text('''#!/usr/bin/env python3
import json, os, sys
a = sys.argv[1:]
with open(os.environ["DOCKER_TEST_LOG"], "a") as f:
    f.write(json.dumps(a) + "\\n")
if "hash-password" in a:
    supplied = sys.stdin.read()
    if not supplied.endswith("\\n"):
        sys.exit(1)
    print(os.environ["DOCKER_TEST_HASH"])
elif a and a[0] == "inspect":
    print(os.environ.get("DOCKER_TEST_HEALTH", "healthy"))
elif "ps" in a and "-q" in a:
    print("test-container")
sys.exit(0)
''')
        docker.chmod(0o700)
        self.password = "correct-horse-$battery-$(touch unsafe)"
        self.password_file = self.root / "password.txt"
        self.password_file.write_text(self.password)
        self.log = self.root / "docker-log.jsonl"
        self.env = dict(os.environ, PATH=str(self.root / "bin") + ":" + os.environ["PATH"],
                        DOCKER_TEST_LOG=str(self.log), DOCKER_TEST_HASH=HASH)

    def run_install(self, *args):
        return subprocess.run(["bash", str(self.root / "install.sh"), *args],
                              cwd=self.root, env=self.env, capture_output=True, text=True, timeout=15)

    def install(self, *args):
        return self.run_install(*args, "--password-file", str(self.password_file))

    def calls(self):
        return [json.loads(x) for x in self.log.read_text().splitlines()] if self.log.exists() else []

    def test_local_install_keeps_secrets_literal_and_private(self):
        result = self.install("--local", "--port", "8181")
        self.assertEqual(result.returncode, 0, result.stderr)
        config = (self.root / ".env").read_text()
        self.assertIn("JHONEME_PASSWORD_HASH='" + HASH + "'", config)
        self.assertIn("JHONEME_LOCAL_PORT='8181'", config)
        self.assertEqual((self.root / ".env").stat().st_mode & 0o777, 0o600)
        self.assertNotIn(self.password, config + result.stdout + result.stderr + self.log.read_text())
        self.assertFalse((self.root / "unsafe").exists())
        self.assertFalse((self.root / ".install-lock").exists())
        self.assertTrue(any(str(self.root / "compose.local.yaml") in a for a in self.calls()))
        self.assertTrue(any("validate" in a for a in self.calls()))

    def test_domain_selects_https(self):
        result = self.install("--domain", "AGENCIA.example.com", "--email", "jhon@example.com")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("https://agencia.example.com", result.stdout)
        self.assertTrue(any(str(self.root / "compose.https.yaml") in a for a in self.calls()))

    def test_invalid_configuration_does_not_call_docker(self):
        for args in (("--domain", "https://example.com"), ("--port", "0"),
                     ("--port", "65536"), ("--user", "name;command"),
                     ("--local", "--domain", "example.com"), ("--unknown",)):
            with self.subTest(args=args):
                self.assertNotEqual(self.install(*args).returncode, 0)
                self.assertEqual(self.calls(), [])
                self.assertFalse((self.root / ".env").exists())

    def test_existing_config_reused_and_changes_refused(self):
        self.assertEqual(self.install().returncode, 0)
        before = (self.root / ".env").read_bytes()
        hashes_before = sum("hash-password" in a for a in self.calls())
        self.assertEqual(self.run_install().returncode, 0)
        self.assertEqual(hashes_before, sum("hash-password" in a for a in self.calls()))
        self.assertNotEqual(self.install("--user", "other").returncode, 0)
        self.assertEqual((self.root / ".env").read_bytes(), before)

    def test_hash_failure_does_not_leave_partial_credentials(self):
        self.env["DOCKER_TEST_HASH"] = "not-a-hash"
        self.assertNotEqual(self.install().returncode, 0)
        self.assertFalse((self.root / ".env").exists())
        self.assertFalse((self.root / ".install-lock").exists())
        self.assertEqual(list(self.root.glob(".env.tmp.*")), [])
        self.assertFalse(any("up" in a for a in self.calls()))

    def test_unhealthy_container_is_not_reported_as_installed(self):
        self.env["DOCKER_TEST_HEALTH"] = "unhealthy"
        result = self.install()
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn("Estúdio iniciado", result.stdout)
        self.assertIn("não ficou saudável", result.stderr)

    def test_short_and_multiline_passwords_rejected(self):
        for password in ("short", "one-line-long\nsecond-line"):
            with self.subTest(password=password):
                self.password_file.write_text(password)
                self.assertNotEqual(self.install().returncode, 0)
                self.assertFalse((self.root / ".env").exists())


if __name__ == "__main__":
    unittest.main(verbosity=2)
