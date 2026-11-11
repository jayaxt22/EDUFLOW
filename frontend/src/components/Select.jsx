import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check } from 'lucide-react';

/**
 * Custom Select component matching EduFlow brand design system.
 * Supports:
 * - Direct `options` array: [{ value, label, disabled }, { label: 'Group', options: [...] }]
 * - Or JSX children: <option value="...">Label</option> and <optgroup label="...">
 * - Dispatches standard { target: { name, value } } events to onChange.
 */
export const Select = ({
  value,
  onChange,
  options: propOptions,
  children,
  placeholder = 'Select an option',
  name,
  id,
  disabled = false,
  required = false,
  className = '',
  icon: LeadingIcon,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Parse children if propOptions is not provided
  const parsedItems = useMemo(() => {
    if (propOptions && Array.isArray(propOptions)) {
      return propOptions;
    }

    const items = [];
    React.Children.forEach(children, (child) => {
      if (!child || !React.isValidElement(child)) return;

      if (child.type === 'optgroup') {
        const groupOptions = [];
        React.Children.forEach(child.props.children, (optChild) => {
          if (optChild && React.isValidElement(optChild) && optChild.type === 'option') {
            groupOptions.push({
              value: optChild.props.value ?? '',
              label: optChild.props.children,
              disabled: Boolean(optChild.props.disabled),
            });
          }
        });
        items.push({
          isGroup: true,
          label: child.props.label,
          options: groupOptions,
        });
      } else if (child.type === 'option') {
        items.push({
          value: child.props.value ?? '',
          label: child.props.children,
          disabled: Boolean(child.props.disabled),
        });
      }
    });

    return items;
  }, [propOptions, children]);

  // Flatten options for easy label lookup
  const flatOptions = useMemo(() => {
    const flat = [];
    parsedItems.forEach((item) => {
      if (item.isGroup && Array.isArray(item.options)) {
        flat.push(...item.options);
      } else {
        flat.push(item);
      }
    });
    return flat;
  }, [parsedItems]);

  // Find currently selected option
  const selectedOption = useMemo(() => {
    if (value === undefined || value === null) return null;
    return flatOptions.find((opt) => String(opt.value) === String(value));
  }, [flatOptions, value]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (val, isDisabled) => {
    if (isDisabled || disabled) return;
    setIsOpen(false);
    if (onChange) {
      onChange({
        target: {
          name: name || id || '',
          value: val,
        },
      });
    }
  };

  const displayLabel = selectedOption
    ? selectedOption.label
    : placeholder;

  const isPlaceholder = !selectedOption || selectedOption.value === '';

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Hidden input for HTML form validation */}
      {required && (
        <input
          type="text"
          name={name}
          id={id}
          value={value ?? ''}
          onChange={() => {}}
          required={required}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs rounded-lg border shadow-sm transition-all text-left focus:outline-none focus:ring-1 focus:ring-[#FACC15] focus:border-[#FACC15] ${
          disabled
            ? 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-400 dark:text-slate-500'
            : isOpen
            ? 'bg-white dark:bg-slate-700 border-[#FACC15] ring-1 ring-[#FACC15] text-[#1E293B] dark:text-slate-100'
            : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-[#1E293B] dark:text-slate-100 hover:border-gray-300 dark:hover:border-slate-500'
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          {LeadingIcon && <LeadingIcon className="w-4 h-4 text-slate-400 shrink-0" />}
          <span className={`truncate ${isPlaceholder ? 'text-gray-400 dark:text-slate-400' : 'font-medium text-[#1E293B] dark:text-slate-100'}`}>
            {displayLabel}
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 dark:text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-yellow-500' : ''
          }`}
        />
      </button>

      {/* Custom Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl py-1 text-xs focus:outline-none animate-in fade-in zoom-in-95 duration-100"
        >
          {flatOptions.length === 0 ? (
            <div className="px-3 py-2 text-center text-gray-400 dark:text-slate-500">
              No options available
            </div>
          ) : (
            parsedItems.map((item, idx) => {
              if (item.isGroup) {
                return (
                  <div key={`group-${idx}`} className="py-1">
                    <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 bg-gray-50/80 dark:bg-slate-900/50">
                      {item.label}
                    </div>
                    {item.options.map((opt) => {
                      const isSelected = String(opt.value) === String(value);
                      return (
                        <div
                          key={String(opt.value)}
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => handleSelect(opt.value, opt.disabled)}
                          className={`px-3 py-2 mx-1 my-0.5 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
                            opt.disabled
                              ? 'opacity-40 cursor-not-allowed text-gray-400 dark:text-slate-600'
                              : isSelected
                              ? 'bg-amber-500/10 text-amber-900 dark:text-yellow-400 font-semibold'
                              : 'text-slate-700 dark:text-slate-200 hover:bg-amber-50/70 dark:hover:bg-slate-700/60'
                          }`}
                        >
                          <span className="truncate">{opt.label}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-amber-600 dark:text-yellow-400 shrink-0 ml-2" />}
                        </div>
                      );
                    })}
                  </div>
                );
              }

              const isSelected = String(item.value) === String(value);
              return (
                <div
                  key={String(item.value)}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(item.value, item.disabled)}
                  className={`px-3 py-2 mx-1 my-0.5 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
                    item.disabled
                      ? 'opacity-40 cursor-not-allowed text-gray-400 dark:text-slate-600'
                      : isSelected
                      ? 'bg-amber-500/10 text-amber-900 dark:text-yellow-400 font-semibold'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-amber-50/70 dark:hover:bg-slate-700/60'
                  }`}
                >
                  <span className="truncate">{item.label}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-amber-600 dark:text-yellow-400 shrink-0 ml-2" />}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
