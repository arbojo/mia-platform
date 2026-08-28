"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  onCheckedChange?: (checked: boolean) => void
}

function Checkbox({ className, label, id, onCheckedChange, ...props }: CheckboxProps) {
  // Hook incondicional (rules-of-hooks): el id explícito tiene prioridad si existe.
  const generatedId = React.useId()
  const checkboxId = id ?? generatedId

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onCheckedChange) {
      onCheckedChange(e.target.checked)
    }
    if (props.onChange) {
      props.onChange(e)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        id={checkboxId}
        data-slot="checkbox"
        className={cn(
          "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        onChange={handleChange}
        {...props}
      />
      {label && (
        <Label htmlFor={checkboxId} className="text-sm font-medium cursor-pointer">
          {label}
        </Label>
      )}
    </div>
  )
}

function Label({ className, htmlFor, children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      htmlFor={htmlFor}
      data-slot="label"
      className={cn(
        "text-sm font-medium select-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </label>
  )
}

export { Checkbox }