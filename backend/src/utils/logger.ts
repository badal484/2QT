import { query } from '../db';

type LogSeverity = 'info' | 'warning' | 'error' | 'critical';

export const logger = {
    log: async (severity: LogSeverity, component: string, eventType: string, message: string, metadata: any = null) => {
        // 1. Console Log for development
        const color = severity === 'error' || severity === 'critical' ? '\x1b[31m' : severity === 'warning' ? '\x1b[33m' : '\x1b[32m';
        console.log(`${color}[SYSTEM:${component}] ${eventType}: ${message}\x1b[0m`);

        // 2. Database Audit Log for Production Integrity
        try {
            await query(`
                INSERT INTO system_audit_logs (severity, component, event_type, message, metadata)
                VALUES ($1, $2, $3, $4, $5)
            `, [severity, component, eventType, message, metadata ? JSON.stringify(metadata) : null]);
        } catch (err) {
            console.error('CRITICAL: Systematic Logging Failed', err);
        }
    },

    info: (component: string, eventType: string, message: string, metadata: any = null) => 
        logger.log('info', component, eventType, message, metadata),
    
    warn: (component: string, eventType: string, message: string, metadata: any = null) => 
        logger.log('warning', component, eventType, message, metadata),
    
    error: (component: string, eventType: string, message: string, metadata: any = null) => 
        logger.log('error', component, eventType, message, metadata),
    
    critical: (component: string, eventType: string, message: string, metadata: any = null) =>
        logger.log('critical', component, eventType, message, metadata),
};

export const logSystemEvent = (eventType: string, message: string, severity: LogSeverity = 'info', metadata: any = null) =>
    logger.log(severity, 'SYSTEM', eventType, message, metadata);
