import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('release', Path(__file__).with_name('release.py'))
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


class ScheduleUpgradeTest(unittest.TestCase):
    origin = 'https://chat.cotticoffee.com'
    goal = {'scheduleId': 'lobe-goal-sweep', 'destination': origin + '/api/workflows/goal/sweep', 'cron': '*/5 * * * *'}
    task = {'scheduleId': 'lobe-task-schedule-dispatch', 'destination': origin + '/api/workflows/task/schedule-dispatch', 'cron': '*/10 * * * *'}

    def test_expected_new_task_schedule(self):
        self.assertTrue(release.schedules_match_release([self.goal], [self.goal, self.task], self.origin))

    def test_existing_schedule_is_not_duplicated(self):
        self.assertTrue(release.schedules_match_release([self.goal, self.task], [self.task, self.goal], self.origin))

    def test_wrong_destination_is_rejected(self):
        wrong = {**self.task, 'destination': 'https://chatdev.cotticoffee.com/api/workflows/task/schedule-dispatch'}
        self.assertFalse(release.schedules_match_release([self.goal], [self.goal, wrong], self.origin))

    def test_missing_existing_schedule_is_rejected(self):
        self.assertFalse(release.schedules_match_release([self.goal], [self.task], self.origin))

    def test_unexpected_extra_schedule_is_rejected(self):
        extra = {**self.task, 'scheduleId': 'unexpected'}
        self.assertFalse(release.schedules_match_release([self.goal], [self.goal, self.task, extra], self.origin))


if __name__ == '__main__':
    unittest.main()
