from datetime import time
from decimal import Decimal

# Shift A: 6:30 AM – 2:00 PM, 20-min break at 10:30 AM
# Shift B: 9:00 AM – 5:00 PM, 20-min break at 1:30 PM
SHIFTS = {
    "SHIFT_A": {
        "label":           "Shift A (6:30 AM – 2:00 PM)",
        "start":           time(6,  30),
        "end":             time(14,  0),
        "break_start":     time(10, 30),
        "break_minutes":   20,
        "effective_hours": Decimal("7.17"),   # (450 - 20) min / 60
    },
    "SHIFT_B": {
        "label":           "Shift B (9:00 AM – 5:00 PM)",
        "start":           time(9,  0),
        "end":             time(17,  0),
        "break_start":     time(13, 30),
        "break_minutes":   20,
        "effective_hours": Decimal("7.67"),   # (480 - 20) min / 60
    },
}

WORKING_DAYS_PER_MONTH = 26
