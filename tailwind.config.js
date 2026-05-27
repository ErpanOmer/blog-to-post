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
				design: {
					primary: '#6366F1',
					primaryHover: '#4F46E5',
					secondary: '#20970B',
					neutral: '#9C9C9C',
					background: '#FAFAFA',
					surface: '#FFFFFF',
					text: '#0A0A0A',
					textSecondary: '#6B6B6B',
					border: '#E8E8EC',
					success: '#10B981',
					warning: '#F59E0B',
					error: '#EF4444',
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
				mono: ['var(--font-mono)'],
			},
			boxShadow: {
				'soft': '0 1px 2px rgba(10, 10, 10, 0.04)',
				'card': '0 1px 2px rgba(10, 10, 10, 0.04)',
				'card-hover': '0 8px 30px rgba(0, 0, 0, 0.08)',
				'elevated': '0 18px 48px -18px rgba(10, 10, 10, 0.24), 0 8px 24px -16px rgba(10, 10, 10, 0.16)',
				'glow': '0 4px 12px rgba(99, 102, 241, 0.35)',
				'glow-lg': '0 4px 12px rgba(99, 102, 241, 0.35)',
				'inner-soft': 'inset 0 1px 0 rgba(255,255,255,0.6)',
			},
			backgroundImage: {
				'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
				'gradient-brand': 'linear-gradient(180deg, #6366f1 0%, #6366f1 100%)',
				'gradient-indigo': 'linear-gradient(180deg, #6366f1 0%, #6366f1 100%)',
				'gradient-blue': 'linear-gradient(180deg, #6366f1 0%, #6366f1 100%)',
				'gradient-card': 'linear-gradient(180deg, #ffffff 0%, #ffffff 100%)',
				'gradient-halo': 'linear-gradient(180deg, transparent 0%, transparent 100%)',
				'gradient-ember': 'linear-gradient(180deg, transparent 0%, transparent 100%)',
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
