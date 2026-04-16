/** @type {import('tailwindcss').Config} */
export default {
	content: [
		"./index.html",
		"./src/react-app/**/*.{ts,tsx}",
		"./src/components/**/*.{ts,tsx}",
	],
	darkMode: ["class"],
	theme: {
    	extend: {
    		colors: {
    			background: 'hsl(var(--background))',
    			foreground: 'hsl(var(--foreground))',
    			border: 'hsl(var(--border))',
    			radius: 'var(--radius)',
    			card: {
    				DEFAULT: 'hsl(var(--card))',
    				foreground: 'hsl(var(--card-foreground))'
    			},
    			popover: {
    				DEFAULT: 'hsl(var(--popover))',
    				foreground: 'hsl(var(--popover-foreground))'
    			},
    			primary: {
    				DEFAULT: 'hsl(var(--primary))',
    				foreground: 'hsl(var(--primary-foreground))'
    			},
    			secondary: {
    				DEFAULT: 'hsl(var(--secondary))',
    				foreground: 'hsl(var(--secondary-foreground))'
    			},
    			muted: {
    				DEFAULT: 'hsl(var(--muted))',
    				foreground: 'hsl(var(--muted-foreground))'
    			},
    			accent: {
    				DEFAULT: 'hsl(var(--accent))',
    				foreground: 'hsl(var(--accent-foreground))'
    			},
    			destructive: {
    				DEFAULT: 'hsl(var(--destructive))',
    				foreground: 'hsl(var(--destructive-foreground))'
    			},
    			input: 'hsl(var(--input))',
    			ring: 'hsl(var(--ring))',
    			chart: {
    				'1': 'hsl(var(--chart-1))',
    				'2': 'hsl(var(--chart-2))',
    				'3': 'hsl(var(--chart-3))',
    				'4': 'hsl(var(--chart-4))',
    				'5': 'hsl(var(--chart-5))'
    			},
				// Brand colors
				brand: {
					50: '#eff6ff',
					100: '#dbeafe',
					200: '#bfdbfe',
					300: '#93c5fd',
					400: '#60a5fa',
					500: '#3b82f6',
					600: '#2563eb',
					700: '#1d4ed8',
					800: '#1e40af',
					900: '#1e3a8a',
					950: '#172554',
				},
				sunset: {
					50: '#fff7ed',
					100: '#ffedd5',
					200: '#fed7aa',
					300: '#fdba74',
					400: '#fb923c',
					500: '#f97316',
					600: '#ea580c',
					700: '#c2410c',
					800: '#9a3412',
					900: '#7c2d12',
					950: '#431407',
				},
				// Status colors
				success: {
					DEFAULT: '#10b981',
					50: '#ecfdf5',
					100: '#d1fae5',
					500: '#10b981',
					600: '#059669',
				},
				warning: {
					DEFAULT: '#f59e0b',
					50: '#fffbeb',
					100: '#fef3c7',
					500: '#f59e0b',
					600: '#d97706',
				},
				info: {
					DEFAULT: '#3b82f6',
					50: '#eff6ff',
					100: '#dbeafe',
					500: '#3b82f6',
					600: '#2563eb',
				},
    		},
    		borderRadius: {
    			lg: 'var(--radius)',
    			md: 'calc(var(--radius) - 2px)',
    			sm: 'calc(var(--radius) - 4px)'
    		},
			fontFamily: {
				sans: ['var(--font-sans)'],
				display: ['var(--font-display)'],
				mono: ['"JetBrains Mono"', '"Cascadia Code"', '"SFMono-Regular"', 'monospace'],
			},
			boxShadow: {
				'soft': '0 12px 32px -20px rgba(15, 23, 42, 0.14), 0 4px 12px -8px rgba(15, 23, 42, 0.08)',
				'card': '0 8px 24px -14px rgba(15, 23, 42, 0.12), 0 2px 8px -4px rgba(15, 23, 42, 0.06)',
				'card-hover': '0 16px 36px -18px rgba(15, 23, 42, 0.16), 0 6px 16px -8px rgba(15, 23, 42, 0.08)',
				'glow': '0 14px 34px -22px rgba(37, 99, 235, 0.35)',
				'glow-lg': '0 18px 42px -24px rgba(37, 99, 235, 0.38)',
				'inner-soft': 'inset 0 1px 0 rgba(255,255,255,0.8), inset 0 -1px 0 rgba(148,163,184,0.08)',
			},
			backgroundImage: {
				'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
				'gradient-brand': 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
				'gradient-indigo': 'linear-gradient(135deg, #334155 0%, #0f172a 100%)',
				'gradient-blue': 'linear-gradient(135deg, #1d4ed8 0%, #0ea5e9 100%)',
				'gradient-card': 'linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(248,250,252,1) 100%)',
				'gradient-halo': 'radial-gradient(circle at top left, rgba(59,130,246,0.08), transparent 55%)',
				'gradient-ember': 'radial-gradient(circle at top right, rgba(14,165,233,0.06), transparent 48%)',
			},
			animation: {
				'fade-in': 'fadeIn 0.3s ease-out',
				'slide-up': 'slideUp 0.4s ease-out',
				'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
				'float-soft': 'floatSoft 8s ease-in-out infinite',
			},
			keyframes: {
				fadeIn: {
					'0%': { opacity: '0' },
					'100%': { opacity: '1' },
				},
				slideUp: {
					'0%': { opacity: '0', transform: 'translateY(10px)' },
					'100%': { opacity: '1', transform: 'translateY(0)' },
				},
				pulseSoft: {
					'0%, 100%': { opacity: '1' },
					'50%': { opacity: '0.7' },
				},
				floatSoft: {
					'0%, 100%': { transform: 'translateY(0px)' },
					'50%': { transform: 'translateY(-8px)' },
				},
			},
    	}
    },
	plugins: [require("tailwindcss-animate")],
};
