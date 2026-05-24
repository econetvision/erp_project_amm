import { useState, useCallback } from "react";

type Validator = (value: any, formData?: Record<string, any>) => string | null;

interface FieldState {
  touched: boolean;
  error: string | null;
}

export function useFormValidation<T extends Record<string, any>>(
  rules: Partial<Record<keyof T, Validator[]>>
) {
  const [fieldState, setFieldState] = useState<Record<string, FieldState>>({});

  const validate = useCallback(
    (name: string, value: any, formData?: Record<string, any>): string | null => {
      const validators = rules[name as keyof T];
      if (!validators) return null;
      for (const v of validators) {
        const error = v(value, formData);
        if (error) return error;
      }
      return null;
    },
    [rules]
  );

  const touch = useCallback(
    (name: string, value: any, formData?: Record<string, any>) => {
      const error = validate(name, value, formData);
      setFieldState((prev) => ({ ...prev, [name]: { touched: true, error } }));
      return error;
    },
    [validate]
  );

  const validateAll = useCallback(
    (formData: T): boolean => {
      const newState: Record<string, FieldState> = {};
      let valid = true;
      for (const key of Object.keys(rules)) {
        const error = validate(key, formData[key], formData);
        newState[key] = { touched: true, error };
        if (error) valid = false;
      }
      setFieldState(newState);
      return valid;
    },
    [rules, validate]
  );

  const getFieldProps = useCallback(
    (name: string) => {
      const fs = fieldState[name];
      if (!fs || !fs.touched) return {};
      return {
        className: fs.error ? "is-invalid" : "is-valid",
        error: fs.error,
      };
    },
    [fieldState]
  );

  const reset = useCallback(() => setFieldState({}), []);

  return { touch, validateAll, getFieldProps, fieldState, reset };
}

// Common validators
export const required = (msg = "This field is required"): Validator =>
  (v) => (!v && v !== 0 ? msg : null);

export const minLength = (n: number, msg?: string): Validator =>
  (v) => (typeof v === "string" && v.length < n ? msg || `Minimum ${n} characters` : null);

export const maxLength = (n: number, msg?: string): Validator =>
  (v) => (typeof v === "string" && v.length > n ? msg || `Maximum ${n} characters` : null);

export const pattern = (regex: RegExp, msg: string): Validator =>
  (v) => (typeof v === "string" && v && !regex.test(v) ? msg : null);

export const minValue = (n: number, msg?: string): Validator =>
  (v) => (Number(v) < n ? msg || `Minimum value is ${n}` : null);

export const email = (msg = "Invalid email address"): Validator =>
  (v) => (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? msg : null);
