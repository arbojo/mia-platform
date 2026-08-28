"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface RadioGroupProps extends React.FieldsetHTMLAttributes<HTMLFieldSetElement> {
  value?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
}

function RadioGroup({ className, value, onValueChange, children, ...props }: RadioGroupProps) {
  return (
    <fieldset
      data-slot="radio-group"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    >
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child
        return React.cloneElement(child, {
          value,
          onValueChange,
        } as Record<string, unknown>)
      })}
    </fieldset>
  )
}

interface RadioGroupItemProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string
  children?: React.ReactNode
  onValueChange?: (value: string) => void
}

function RadioGroupItem({ className, value: itemValue, children, onValueChange, ...props }: RadioGroupItemProps) {
  const context = React.useContext(RadioGroupContext)
  const groupValue = context?.value ?? itemValue
  const onChange = context?.onValueChange ?? onValueChange

  const id = React.useId()

  return (
    <div className="relative">
      <input
        type="radio"
        id={id}
        value={itemValue}
        checked={groupValue === itemValue}
        onChange={() => onChange?.(itemValue)}
        data-slot="radio-group-item"
        className={cn(
          "peer h-4 w-4 shrink-0 rounded-full border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
      {children && (
        <label
          htmlFor={id}
          className="absolute inset-0 flex items-center pl-10 text-sm font-medium cursor-pointer"
        >
          {children}
        </label>
      )}
    </div>
  )
}

const RadioGroupContext = React.createContext<{ value?: string; onValueChange?: (value: string) => void } | null>(null)

RadioGroup.Item = RadioGroupItem

export { RadioGroup }