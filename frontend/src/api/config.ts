const runtimeOrigin = typeof window !== 'undefined'
	&& window.location.hostname !== 'localhost'
	&& window.location.hostname !== '127.0.0.1'
	? window.location.origin
	: 'http://localhost:5000';

export const API_ORIGIN = import.meta.env.VITE_API_ORIGIN ?? runtimeOrigin;
export const API_BASE = `${API_ORIGIN}/api/v1`;