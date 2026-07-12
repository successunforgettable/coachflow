# Kong Tab Styling Specifications

Extracted from Kong's Headlines results page on 2026-02-20.

## HTML Structure

```html
<div class="flex border dark:border-none dark:bg-dark-400 shadow-sm rounded-xl p-1.5 bg-white mb-6">
  <button id="flatTabs-0" class="w-1/2 py-[.65rem] cursor-pointer rounded-lg text-center text-gray-500 dark:text-white font-semibold text-xs md:text-sm !bg-purple-600 dark:!bg-dark-600 !text-white shadow-sm">
    Headlines
  </button>
  <button id="flatTabs-1" class="w-1/2 py-[.65rem] cursor-pointer rounded-lg text-center text-gray-500 dark:text-white font-semibold text-xs md:text-sm">
    Beast Mode
  </button>
</div>
```

## Container Styling

- **Display**: `flex`
- **Border**: `border` (light mode), `dark:border-none` (dark mode)
- **Background**: `bg-white` (light mode), `dark:bg-dark-400` (dark mode)
- **Shadow**: `shadow-sm`
- **Border Radius**: `rounded-xl` (12px)
- **Padding**: `p-1.5` (6px)
- **Margin Bottom**: `mb-6` (24px)

## Tab Button Styling (Inactive)

- **Width**: `w-1/2` (50% of container)
- **Padding**: `py-[.65rem]` (10.4px vertical, 0px horizontal)
- **Font Size**: `text-xs md:text-sm` (12px mobile, 14px desktop)
- **Font Weight**: `font-semibold` (600)
- **Text Color**: `text-gray-500` (light mode), `dark:text-white` (dark mode)
- **Background**: `transparent` (rgba(0, 0, 0, 0))
- **Border Radius**: `rounded-lg` (8px)
- **Text Align**: `text-center`
- **Cursor**: `cursor-pointer`
- **Transition**: `all`

## Tab Button Styling (Active)

- **Background**: `!bg-purple-600` (rgb(123, 38, 250) - light mode), `dark:!bg-dark-600` (dark mode)
- **Text Color**: `!text-white` (rgb(255, 255, 255))
- **Shadow**: `shadow-sm`
- **All other styles**: Same as inactive

## Key Design Principles

1. **Pill-style tabs** - Rounded container with rounded buttons inside
2. **Subtle container** - Light border + shadow, not heavy
3. **Active state uses brand color** - Purple (#7B26FA)
4. **Inactive tabs are transparent** - No background, just text
5. **Equal width tabs** - Each tab is 50% width (w-1/2)
6. **Compact padding** - 6px container padding, 10.4px button padding
7. **Smooth transitions** - All properties transition
8. **Responsive font size** - 12px mobile, 14px desktop

## Differences from shadcn/ui Tabs

Kong uses a **custom pill-style design** instead of shadcn/ui's default underline tabs:

- shadcn/ui: Underline style with border-bottom
- Kong: Pill/button style with background color

## Implementation for CoachFlow

We should match Kong's exact styling:

```tsx
<div className="flex border dark:border-none dark:bg-gray-800 shadow-sm rounded-xl p-1.5 bg-white mb-6">
  <button 
    className={`
      w-1/2 py-[.65rem] cursor-pointer rounded-lg text-center 
      text-gray-500 dark:text-white font-semibold text-xs md:text-sm
      transition-all
      ${active ? '!bg-purple-600 dark:!bg-gray-700 !text-white shadow-sm' : ''}
    `}
  >
    Tab Label
  </button>
</div>
```

## Color Values

- **Active background (light)**: `#7B26FA` (Kong's purple)
- **Active background (dark)**: Dark gray
- **Active text**: `#FFFFFF` (white)
- **Inactive text (light)**: `#6B7280` (gray-500)
- **Inactive text (dark)**: `#FFFFFF` (white)
- **Container background (light)**: `#FFFFFF` (white)
- **Container background (dark)**: Dark gray-400

## Spacing

- Container padding: 6px
- Button vertical padding: 10.4px
- Button horizontal padding: 0px
- Container margin-bottom: 24px
- Border radius (container): 12px
- Border radius (buttons): 8px
