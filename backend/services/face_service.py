import base64
import io
import numpy as np
from PIL import Image
import face_recognition
from fastapi import HTTPException


def decode_image(b64: str) -> np.ndarray:
    """Decode a base64 JPEG/PNG string into an RGB numpy array."""
    if "," in b64:
        b64 = b64.split(",", 1)[1]
    # Fix padding if needed
    b64 = b64.strip()
    padding = 4 - len(b64) % 4
    if padding != 4:
        b64 += "=" * padding
    try:
        img_bytes = base64.b64decode(b64)
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        return np.array(img)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image data: {str(e)}")


def normalize_face_encoding(raw_encoding) -> np.ndarray:
    """Normalize face encoding to a 128-element float array."""
    if raw_encoding is None:
        raise HTTPException(status_code=400, detail="No face encoding available for comparison.")
    try:
        encoding = np.asarray(raw_encoding, dtype=np.float64)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Invalid stored face encoding: {str(e)}")

    if encoding.ndim != 1 or encoding.shape[0] != 128:
        raise HTTPException(
            status_code=500,
            detail="Stored face encoding is invalid or malformed. Expected 128 float values."
        )
    return encoding


def get_face_encoding(b64_image: str) -> list[float]:
    """Return a 128-d face encoding from a base64 image. Raises if no face found."""
    try:
        img = decode_image(b64_image)
        encodings = face_recognition.face_encodings(img)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Face processing error: {str(e)}")
    if not encodings:
        raise HTTPException(status_code=400, detail="No face detected in the image. Please try again with better lighting.")
    encoding = encodings[0]
    if len(encoding) != 128:
        raise HTTPException(status_code=500, detail="Detected face encoding is invalid.")
    return [float(x) for x in encoding]


def verify_employee_face(b64_image: str, employee) -> None:
    """
    Verify that the face in b64_image matches the given employee's registered encoding.
    Raises HTTP 400 if no face detected, 403 if face does not match.
    """
    if employee.face_encoding is None:
        raise HTTPException(
            status_code=400,
            detail=f"No face registered for {employee.name}. Please register a face first."
        )
    try:
        img = decode_image(b64_image)
        unknown_encodings = face_recognition.face_encodings(img)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Face processing error: {str(e)}")

    if not unknown_encodings:
        raise HTTPException(status_code=400, detail="No face detected in the image. Please try again.")

    known_enc   = normalize_face_encoding(employee.face_encoding)
    unknown_enc = unknown_encodings[0]
    match = face_recognition.compare_faces([known_enc], unknown_enc, tolerance=0.5)[0]
    if not match:
        raise HTTPException(status_code=403, detail="Face verification failed. Identity does not match.")


def identify_employee(b64_image: str, employees: list) -> object | None:
    """
    Compare the face in b64_image against all employees with a stored face_encoding.
    Returns the matching Employee ORM object or None.
    """
    try:
        img = decode_image(b64_image)
        unknown_encodings = face_recognition.face_encodings(img)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Face processing error: {str(e)}")

    if not unknown_encodings:
        return None

    unknown_enc = unknown_encodings[0]
    candidates = [e for e in employees if e.face_encoding is not None]

    if not candidates:
        return None

    known_encodings = []
    valid_candidates = []
    for e in candidates:
        try:
            known_encodings.append(normalize_face_encoding(e.face_encoding))
            valid_candidates.append(e)
        except HTTPException:
            continue

    if not known_encodings:
        return None

    matches = face_recognition.compare_faces(known_encodings, unknown_enc, tolerance=0.5)
    distances = face_recognition.face_distance(known_encodings, unknown_enc)

    best_idx = int(np.argmin(distances))
    if matches[best_idx]:
        return valid_candidates[best_idx]
    return None
