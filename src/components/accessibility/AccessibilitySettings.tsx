'use client'

import { useAccessibility } from '@/components/dashboard/AccessibilityProvider'
import { useI18n } from '@/components/dashboard/I18nProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type {
  AccessibilityPreferences,
  ColorTemperature,
  FontWeightPreference,
} from '@/lib/system/accessibility'
import { DEFAULT_ACCESSIBILITY_PREFERENCES } from '@/lib/system/accessibility'

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200"
      style={{
        backgroundColor: checked ? 'var(--atmosphere-accent)' : 'rgba(255,255,255,0.12)',
      }}
    >
      <span
        className="inline-block h-4 w-4 transform rounded-full transition-transform duration-200"
        style={{
          backgroundColor: checked ? '#fff' : 'var(--atmosphere-text-secondary)',
          transform: checked ? 'translateX(24px)' : 'translateX(3px)',
        }}
      />
    </button>
  )
}

function SegmentedOption<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div
      className="inline-flex rounded-lg p-1"
      style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200',
          )}
          style={{
            color:
              option.value === value
                ? '#fff'
                : 'var(--atmosphere-text-secondary)',
            backgroundColor:
              option.value === value ? 'var(--atmosphere-accent)' : 'transparent',
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function AccessibilitySettings() {
  const { preferences, loaded, update } = useAccessibility()
  const { t } = useI18n()

  const set = (patch: Partial<AccessibilityPreferences>) => update(patch)

  const FONT_WEIGHT_OPTIONS: { value: FontWeightPreference; label: string }[] = [
    { value: 'normal', label: t.accessibility.fontWeightNormal },
    { value: 'medium', label: t.accessibility.fontWeightMedium },
    { value: 'bold', label: t.accessibility.fontWeightBold },
  ]

  const TEMPERATURE_OPTIONS: { value: ColorTemperature; label: string }[] = [
    { value: 'neutral', label: t.accessibility.colorNeutral },
    { value: 'warm', label: t.accessibility.colorWarm },
    { value: 'cool', label: t.accessibility.colorCool },
  ]

  if (!loaded) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          {t.common.loading}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.accessibility.layout}</CardTitle>
          <CardDescription>
            {t.accessibility.layoutDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{t.accessibility.mirrorMode}</p>
              <p className="text-xs text-muted-foreground">{t.accessibility.mirrorModeLabel}</p>
            </div>
            <Toggle
              checked={preferences.mirror_layout}
              onChange={(value) => set({ mirror_layout: value })}
              label={t.accessibility.mirrorMode}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.accessibility.opticalComfort}</CardTitle>
          <CardDescription>
            {t.accessibility.opticalComfortDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{t.accessibility.opticalMode}</p>
              <p className="text-xs text-muted-foreground">{t.accessibility.opticalModeLabel}</p>
            </div>
            <Toggle
              checked={preferences.optical_mode}
              onChange={(value) => set({ optical_mode: value })}
              label={t.accessibility.opticalMode}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.accessibility.typography}</CardTitle>
          <CardDescription>
            {t.accessibility.typographyDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-medium">{t.accessibility.fontWeight}</p>
            <SegmentedOption
              options={FONT_WEIGHT_OPTIONS}
              value={preferences.font_weight}
              onChange={(font_weight) => set({ font_weight })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.accessibility.colorTemperature}</CardTitle>
          <CardDescription>
            {t.accessibility.colorTemperatureDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-medium">{t.accessibility.color}</p>
            <SegmentedOption
              options={TEMPERATURE_OPTIONS}
              value={preferences.color_temperature}
              onChange={(color_temperature) => set({ color_temperature })}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardContent className="flex items-center justify-between pt-6">
          <div>
            <p className="text-sm font-medium">{t.accessibility.resetTitle}</p>
            <p className="text-xs text-muted-foreground">
              {t.accessibility.resetDescription}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => set(DEFAULT_ACCESSIBILITY_PREFERENCES)}
          >
            {t.common.reset}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
