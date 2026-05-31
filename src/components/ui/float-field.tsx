"use client";

import { type ChangeEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type CommonProps = {
  label?: string;
  error?: string;
  hint?: string;
  className?: string;
};

type InputProps = CommonProps &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "className"> & {
    as?: "input";
    onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
    value?: string | number;
  };

type TextareaProps = CommonProps &
  Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> & {
    as: "textarea";
    onChange?: (event: ChangeEvent<HTMLTextAreaElement>) => void;
    value?: string;
  };

type SelectProps = CommonProps &
  Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "className"> & {
    as: "select";
    onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
    value?: string;
    children?: ReactNode;
  };

export type FloatFieldProps = InputProps | TextareaProps | SelectProps;

/**
 * Form-aesthetic field used throughout the registration / contact modals.
 *
 * Note: the design name is "float-label" but the actual implementation
 * uses a permanent `placeholder=" "` strategy combined with the `.ff-*`
 * CSS that sets a fixed 60px input height — placeholders read as labels
 * when the user hasn't typed anything. This avoids the popping-label
 * animation while still matching the visual rhythm in Figma.
 */
export function FloatField(props: FloatFieldProps) {
  const { label, error, hint, className } = props;

  const wrapperClass = cn("ff", error && "ff-err", className);

  if (props.as === "textarea") {
    const { as: _as, label: _l, error: _e, hint: _h, className: _c, ...rest } = props;
    void _as; void _l; void _e; void _h; void _c;
    return (
      <label className={wrapperClass}>
        <textarea className="ff-textarea" placeholder={label} {...rest} />
        {renderHint(error, hint)}
      </label>
    );
  }

  if (props.as === "select") {
    const { as: _as, label: _l, error: _e, hint: _h, className: _c, children, ...rest } = props;
    void _as; void _l; void _e; void _h; void _c;
    return (
      <label className={wrapperClass}>
        <select className="ff-select" aria-label={label} {...rest}>
          {children}
        </select>
        {renderHint(error, hint)}
      </label>
    );
  }

  const { as: _as, label: _l, error: _e, hint: _h, className: _c, type = "text", ...rest } = props;
  void _as; void _l; void _e; void _h; void _c;
  return (
    <label className={wrapperClass}>
      <input className="ff-input" type={type} placeholder={label} {...rest} />
      {renderHint(error, hint)}
    </label>
  );
}

function renderHint(error?: string, hint?: string) {
  if (error) return <span className="ff-error-msg">{error}</span>;
  if (hint) return <span className="ff-error-msg">{hint}</span>;
  return null;
}
