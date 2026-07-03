"""Domain models + the application status machine."""

from enum import Enum


class Status(str, Enum):
    NOT_STARTED = "NOT_STARTED"
    IN_PROGRESS = "IN_PROGRESS"
    NEEDS_HUMAN = "NEEDS_HUMAN"        # paused: CAPTCHA / OTP / payment / review
    READY_FOR_REVIEW = "READY_FOR_REVIEW"
    SUBMITTED = "SUBMITTED"
    FAILED = "FAILED"
    MISSING_DATA = "MISSING_DATA"      # student is missing required fields


# Legal transitions — guards the flow so a job can't skip states.
ALLOWED = {
    Status.NOT_STARTED: {Status.IN_PROGRESS, Status.MISSING_DATA, Status.FAILED},
    Status.IN_PROGRESS: {Status.NEEDS_HUMAN, Status.READY_FOR_REVIEW, Status.FAILED},
    Status.NEEDS_HUMAN: {Status.IN_PROGRESS, Status.READY_FOR_REVIEW, Status.FAILED},
    Status.READY_FOR_REVIEW: {Status.SUBMITTED, Status.IN_PROGRESS, Status.FAILED},
    Status.SUBMITTED: set(),
    Status.FAILED: {Status.NOT_STARTED},       # retry
    Status.MISSING_DATA: {Status.NOT_STARTED},  # re-queue after data is added
}


def can_transition(current: Status, target: Status) -> bool:
    return target in ALLOWED.get(current, set())
