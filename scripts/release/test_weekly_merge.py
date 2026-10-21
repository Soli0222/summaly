import unittest

from weekly_merge import candidate, checks_succeeded


class WeeklyMergeTest(unittest.TestCase):
    def test_only_release_app_master_branch(self):
        pr = {"headRefName": "release-please--branches--master--components--summaly", "isDraft": False,
              "author": {"login": "app/release-bot", "is_bot": True}}
        self.assertTrue(candidate(pr, "release-bot"))
        self.assertFalse(candidate(pr, "different-app"))
        self.assertFalse(candidate({**pr, "isDraft": True}, "release-bot"))
        self.assertFalse(candidate({**pr, "headRefName": "release-please--branches--main"}, "release-bot"))

    def test_both_application_checks_must_succeed(self):
        checks = [{"name": name, "status": "COMPLETED", "conclusion": "SUCCESS"}
                  for name in ["test", "lint", "Guard chart version"]]
        self.assertTrue(checks_succeeded(checks))
        self.assertFalse(checks_succeeded([]))
        self.assertFalse(checks_succeeded(checks[:1]))
        self.assertFalse(checks_succeeded(checks + [{"name": "build", "status": "IN_PROGRESS"}]))
        self.assertFalse(checks_succeeded(checks + [{"name": "build", "status": "COMPLETED", "conclusion": "FAILURE"}]))


if __name__ == "__main__":
    unittest.main()
