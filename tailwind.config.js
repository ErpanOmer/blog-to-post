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
				// Brand colors — shifted to indigo for a more premium feel
				brand: {
					50: '#eef2ff',
					100: '#e0e7ff',
					200: '#c7d2fe',
					300: '#a5b4fc',
					400: '#818cf8',
					500: '#6366f1',
					600: '#4f46e5',
					700: '#4338ca',
					800: '#3730a3',
					900: '#312e81',
					950: '#1e1b4b',
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
					DEFAULT: '#6366f1',
					50: '#eef2ff',
					100: '#e0e7ff',
					500: '#6366f1',
					600: '#4f46e5',
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
				'soft': '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)',
				'card': '0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 16px -2px rgba(0, 0, 0, 0.04)',
				'card-hover': '0 8px 24px -4px rgba(0, 0, 0, 0.08), 0 4px 12px -2px rgba(0, 0, 0, 0.04)',
				'elevated': '0 10px 32px -4px rgba(0, 0, 0, 0.1), 0 6px 16px -2px rgba(0, 0, 0, 0.06)',
				'glow': '0 0 20px -4px rgba(99, 102, 241, 0.25)',
				'glow-lg': '0 0 30px -4px rgba(99, 102, 241, 0.3)',
				'inner-soft': 'inset 0 1px 0 rgba(255,255,255,0.6)',
			},
			backgroundImage: {
				'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
				'gradient-brand': 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
				'gradient-indigo': 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
				'gradient-blue': 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
				'gradient-card': 'linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(248,250,252,1) 100%)',
				'gradient-halo': 'radial-gradient(circle at top left, rgba(99,102,241,0.06), transparent 50%)',
				'gradient-ember': 'radial-gradient(circle at top right, rgba(244,114,182,0.04), transparent 45%)',
			},
			animation: {
				'fade-in': 'fadeIn 0.3s ease-out',
				'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
				'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
				'float-soft': 'floatSoft 8s ease-in-out infinite',
				'scale-in': 'scaleIn 0.2s ease-out',
			},
			keyframes: {
				fadeIn: {
					'0%': { opacity: '0' },
					'100%': { opacity: '1' },
				},
				slideUp: {
					'0%': { opacity: '0', transform: 'translateY(8px)' },
					'100%': { opacity: '1', transform: 'translateY(0)' },
				},
				pulseSoft: {
					'0%, 100%': { opacity: '1' },
					'50%': { opacity: '0.7' },
				},
				floatSoft: {
					'0%, 100%': { transform: 'translateY(0px)' },
					'50%': { transform: 'translateY(-6px)' },
				},
				scaleIn: {
					'0%': { opacity: '0', transform: 'scale(0.95)' },
					'100%': { opacity: '1', transform: 'scale(1)' },
				},
			},
    	}
    },
	plugins: [require("tailwindcss-animate")],
};
