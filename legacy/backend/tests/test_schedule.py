import typing
from datetime import date, timedelta

import pytest

import schedule
import tool_models as tm

FAR = date.today().year + 3  # far enough ahead that no window has passed


def run(start_term=f"Fall {FAR}", fixed=()):
    args = tm.ScheduleArgs(college="X", start_term=start_term, fixed_dates=[tm.FixedDate(**f) for f in fixed])
    return {step.step_type: step for step in schedule.schedule_steps(args).steps}


@pytest.mark.parametrize("term, expected", [
    ("February 2027", date(2027, 2, 1)),
    ("fall 2027", date(2027, 8, 1)),
    ("Spring 2028", date(2028, 1, 1)),
    ("Sept 2027", date(2027, 9, 1)),
    ("soon", None),
    ("Smarch 2027", None),
])
def test_parse_term(term, expected):
    assert schedule.parse_term(term) == expected


def test_every_step_type_gets_a_window():
    steps = run()
    assert set(steps) == set(typing.get_args(tm.StepType)) == set(schedule.RULES)
    for step in steps.values():
        assert step.start_date <= step.end_date


def test_windows_count_back_from_the_start_and_application():
    start = date(FAR, 8, 1)
    steps = run()
    application = start + timedelta(days=schedule.DEFAULT_APPLICATION_DEADLINE)
    assert steps["application"].end_date == application
    assert steps["visa"].end_date == start - timedelta(days=60)
    assert steps["travel"].start_date == start - timedelta(days=30)  # F-1 arrival limit
    assert steps["test"].end_date == application - timedelta(days=45)
    assert "before the program start" in steps["visa"].rule


def test_rigid_deadlines_win_and_move_dependent_steps():
    deadline = date(FAR - 1, 12, 15)
    steps = run(fixed=[{"step_type": "application", "end_date": deadline}])
    assert steps["application"].end_date == deadline and steps["application"].rule == "Fixed deadline"
    assert steps["language"].end_date == deadline - timedelta(days=30)
    assert steps["cost"].start_date == deadline + timedelta(days=30)


def test_earliest_of_several_fixed_deadlines_counts_and_keeps_its_start():
    steps = run(fixed=[
        {"step_type": "scholarship", "end_date": date(FAR, 2, 1)},
        {"step_type": "scholarship", "start_date": date(FAR - 1, 11, 1), "end_date": date(FAR, 1, 10)},
    ])
    assert (steps["scholarship"].start_date, steps["scholarship"].end_date) == (date(FAR - 1, 11, 1), date(FAR, 1, 10))


def test_passed_windows_start_today_but_fixed_ones_stay_overdue():
    last_year = date.today().year - 1
    steps = run(start_term=f"January {date.today().year}", fixed=[{"step_type": "insurance", "end_date": date(last_year, 1, 1)}])
    assert steps["visa"].start_date == date.today() and "passed" in steps["visa"].rule
    assert steps["insurance"].end_date == date(last_year, 1, 1)


def test_unreadable_start_term_is_an_error():
    with pytest.raises(ValueError):
        run(start_term="whenever")
