import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs-extra';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

export interface User {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  role: string;
  avatar?: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentOrder {
  id: string;
  user_id: string;
  order_no: string;
  amount: number;
  payment_method: 'wechat' | 'alipay';
  status: 'pending' | 'paid' | 'cancelled' | 'refunded';
  description: string;
  plan_id?: string;
  pay_url?: string;
  paid_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  duration_days: number;
  features: string;
  created_at: string;
}

export interface Agent {
  id: string;
  hostname: string;
  os: string;
  nginx_version: string;
  nginx_config: string;
  version: string;
  last_seen: string;
  created_at: string;
  status: 'active' | 'inactive' | 'error';
}

export interface AgentActivity {
  id: number;
  agent_id: string;
  action: string;
  details: any;
  timestamp: string;
}

export interface RenewalSchedule {
  id: string;
  certificate_id: string;
  cron_expression: string;
  days_before_expiry: number;
  enabled: boolean;
  last_run?: string;
  next_run?: string;
  last_result?: 'success' | 'failed' | 'skipped';
  last_error?: string;
  created_at: string;
  updated_at: string;
}

export interface DeploymentTask {
  id: string;
  certificate_id: string;
  agent_id: string;
  target_type: string;
  target_config: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  started_at?: string;
  completed_at?: string;
  error?: string;
  logs: string;
  created_at: string;
  updated_at: string;
}

export interface Certificate {
  id: string;
  domains: string;
  certificate: string;
  private_key: string;
  certificate_chain: string;
  ca: string;
  status: 'active' | 'expired' | 'revoked' | 'pending';
  issued_at: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
  auto_renew: boolean;
  renew_days: number;
}

/**
 * 数据库服务类
 * 使用 SQLite 存储 Agent 信息和活动日志
 */
export class Database {
  private static instance: Database;
  private db: sqlite3.Database | null = null;
  private dbPath: string;

  private constructor() {
    this.dbPath = path.join(process.cwd(), 'data', 'newhttps.db');
  }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  /**
   * 初始化数据库
   */
  async init(): Promise<void> {
    try {
      // 确保数据目录存在
      await fs.ensureDir(path.dirname(this.dbPath));

      return new Promise((resolve, reject) => {
        this.db = new sqlite3.Database(this.dbPath, (err) => {
          if (err) {
            logger.error('Failed to open database:', err);
            reject(err);
          } else {
            logger.info(`Database connected: ${this.dbPath}`);
            this.createTables().then(resolve).catch(reject);
          }
        });
      });
    } catch (error) {
      logger.error('Database initialization failed:', error);
      throw error;
    }
  }

  /**
   * 创建数据表
   */
  private async createTables(): Promise<void> {
    const createAgentsTable = `
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        hostname TEXT NOT NULL,
        os TEXT,
        nginx_version TEXT,
        nginx_config TEXT,
        version TEXT,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'active'
      )
    `;

    const createActivitiesTable = `
      CREATE TABLE IF NOT EXISTS agent_activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agent_id) REFERENCES agents (id)
      )
    `;

    const createCertificatesTable = `
      CREATE TABLE IF NOT EXISTS certificates (
        id TEXT PRIMARY KEY,
        domains TEXT NOT NULL,
        certificate TEXT NOT NULL,
        private_key TEXT NOT NULL,
        certificate_chain TEXT NOT NULL,
        ca TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        issued_at DATETIME NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        auto_renew BOOLEAN DEFAULT 1,
        renew_days INTEGER DEFAULT 30
      )
    `;

    const createRenewalSchedulesTable = `
      CREATE TABLE IF NOT EXISTS renewal_schedules (
        id TEXT PRIMARY KEY,
        certificate_id TEXT NOT NULL,
        cron_expression TEXT NOT NULL,
        days_before_expiry INTEGER DEFAULT 30,
        enabled BOOLEAN DEFAULT 1,
        last_run DATETIME,
        next_run DATETIME,
        last_result TEXT,
        last_error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (certificate_id) REFERENCES certificates (id)
      )
    `;

    const createDeploymentTasksTable = `
      CREATE TABLE IF NOT EXISTS deployment_tasks (
        id TEXT PRIMARY KEY,
        certificate_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_config TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        progress INTEGER DEFAULT 0,
        started_at DATETIME,
        completed_at DATETIME,
        error TEXT,
        logs TEXT DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (certificate_id) REFERENCES certificates (id),
        FOREIGN KEY (agent_id) REFERENCES agents (id)
      )
    `;

    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        avatar TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createPaymentOrdersTable = `
      CREATE TABLE IF NOT EXISTS payment_orders (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        order_no TEXT NOT NULL UNIQUE,
        amount REAL NOT NULL,
        payment_method TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        description TEXT,
        plan_id TEXT,
        pay_url TEXT,
        paid_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `;

    const createPaymentPlansTable = `
      CREATE TABLE IF NOT EXISTS payment_plans (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        duration_days INTEGER NOT NULL,
        features TEXT DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.serialize(() => {
        this.db!.run(createAgentsTable, (err) => {
          if (err) {
            logger.error('Failed to create agents table:', err);
            reject(err);
            return;
          }
        });

        this.db!.run(createActivitiesTable, (err) => {
          if (err) {
            logger.error('Failed to create activities table:', err);
            reject(err);
            return;
          }
        });

        this.db!.run(createCertificatesTable, (err) => {
          if (err) {
            logger.error('Failed to create certificates table:', err);
            reject(err);
            return;
          }
        });

        this.db!.run(createRenewalSchedulesTable, (err) => {
          if (err) {
            logger.error('Failed to create renewal schedules table:', err);
            reject(err);
            return;
          }
        });

        this.db!.run(createDeploymentTasksTable, (err) => {
          if (err) {
            logger.error('Failed to create deployment tasks table:', err);
            reject(err);
            return;
          }
        });

        this.db!.run(createUsersTable, (err) => {
          if (err) {
            logger.error('Failed to create users table:', err);
            reject(err);
            return;
          }
        });

        this.db!.run(createPaymentOrdersTable, (err) => {
          if (err) {
            logger.error('Failed to create payment_orders table:', err);
            reject(err);
            return;
          }
        });

        this.db!.run(createPaymentPlansTable, (err) => {
          if (err) {
            logger.error('Failed to create payment_plans table:', err);
            reject(err);
            return;
          }
          resolve();
        });
      });
    });
  }

  /**
   * 注册或更新 Agent
   */
  async registerAgent(agent: Omit<Agent, 'last_seen' | 'created_at' | 'status'>): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        INSERT OR REPLACE INTO agents 
        (id, hostname, os, nginx_version, nginx_config, version, last_seen)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;

      this.db.run(sql, [
        agent.id,
        agent.hostname,
        agent.os,
        agent.nginx_version,
        agent.nginx_config,
        agent.version
      ], (err) => {
        if (err) {
          logger.error('Failed to register agent:', err);
          reject(err);
        } else {
          logger.info(`Agent registered: ${agent.id}`);
          resolve();
        }
      });
    });
  }

  /**
   * 获取 Agent 信息
   */
  async getAgent(agentId: string): Promise<Agent | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = 'SELECT * FROM agents WHERE id = ?';
      
      this.db.get(sql, [agentId], (err, row: Agent) => {
        if (err) {
          logger.error('Failed to get agent:', err);
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    });
  }

  /**
   * 获取所有 Agent 列表
   */
  async getAllAgents(): Promise<Agent[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = 'SELECT * FROM agents ORDER BY last_seen DESC';
      
      this.db.all(sql, [], (err, rows: Agent[]) => {
        if (err) {
          logger.error('Failed to get agents:', err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * 更新 Agent 最后活跃时间
   */
  async updateAgentLastSeen(agentId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = 'UPDATE agents SET last_seen = CURRENT_TIMESTAMP WHERE id = ?';
      
      this.db.run(sql, [agentId], (err) => {
        if (err) {
          logger.error('Failed to update agent last seen:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * 记录 Agent 活动
   */
  async logAgentActivity(agentId: string, action: string, details: any = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        INSERT INTO agent_activities (agent_id, action, details)
        VALUES (?, ?, ?)
      `;
      
      this.db.run(sql, [agentId, action, JSON.stringify(details)], (err) => {
        if (err) {
          logger.error('Failed to log agent activity:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * 获取 Agent 活动日志
   */
  async getAgentActivities(agentId: string, limit: number = 100): Promise<AgentActivity[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        SELECT * FROM agent_activities 
        WHERE agent_id = ? 
        ORDER BY timestamp DESC 
        LIMIT ?
      `;
      
      this.db.all(sql, [agentId, limit], (err, rows: AgentActivity[]) => {
        if (err) {
          logger.error('Failed to get agent activities:', err);
          reject(err);
        } else {
          // 解析 details JSON
          const activities = rows.map(row => ({
            ...row,
            details: JSON.parse(row.details || '{}')
          }));
          resolve(activities);
        }
      });
    });
  }

  /**
   * 保存证书到数据库
   */
  async saveCertificate(certificate: Omit<Certificate, 'created_at' | 'updated_at'>): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        INSERT OR REPLACE INTO certificates
        (id, domains, certificate, private_key, certificate_chain, ca, status,
         issued_at, expires_at, auto_renew, renew_days)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      this.db.run(sql, [
        certificate.id,
        certificate.domains,
        certificate.certificate,
        certificate.private_key,
        certificate.certificate_chain,
        certificate.ca,
        certificate.status,
        certificate.issued_at,
        certificate.expires_at,
        certificate.auto_renew ? 1 : 0,
        certificate.renew_days
      ], (err) => {
        if (err) {
          logger.error('Failed to save certificate:', err);
          reject(err);
        } else {
          logger.info(`Certificate saved: ${certificate.id}`);
          resolve();
        }
      });
    });
  }

  /**
   * 获取证书
   */
  async getCertificate(certificateId: string): Promise<Certificate | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = 'SELECT * FROM certificates WHERE id = ?';

      this.db.get(sql, [certificateId], (err, row: Certificate) => {
        if (err) {
          logger.error('Failed to get certificate:', err);
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    });
  }

  /**
   * 获取所有证书
   */
  async getAllCertificates(): Promise<Certificate[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = 'SELECT * FROM certificates ORDER BY created_at DESC';

      this.db.all(sql, [], (err, rows: Certificate[]) => {
        if (err) {
          logger.error('Failed to get certificates:', err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * 更新证书
   */
  async updateCertificate(certificate: Certificate): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        UPDATE certificates SET
        domains = ?, certificate = ?, private_key = ?, certificate_chain = ?,
        ca = ?, status = ?, issued_at = ?, expires_at = ?,
        auto_renew = ?, renew_days = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      this.db.run(sql, [
        certificate.domains,
        certificate.certificate,
        certificate.private_key,
        certificate.certificate_chain,
        certificate.ca,
        certificate.status,
        certificate.issued_at,
        certificate.expires_at,
        certificate.auto_renew ? 1 : 0,
        certificate.renew_days,
        certificate.id
      ], (err) => {
        if (err) {
          logger.error('Failed to update certificate:', err);
          reject(err);
        } else {
          logger.info(`Certificate updated: ${certificate.id}`);
          resolve();
        }
      });
    });
  }

  /**
   * 删除证书
   */
  async deleteCertificate(certificateId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = 'DELETE FROM certificates WHERE id = ?';

      this.db.run(sql, [certificateId], (err) => {
        if (err) {
          logger.error('Failed to delete certificate:', err);
          reject(err);
        } else {
          logger.info(`Certificate deleted: ${certificateId}`);
          resolve();
        }
      });
    });
  }

  /**
   * 保存续期调度
   */
  async saveRenewalSchedule(schedule: Omit<RenewalSchedule, 'created_at' | 'updated_at'>): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        INSERT OR REPLACE INTO renewal_schedules
        (id, certificate_id, cron_expression, days_before_expiry, enabled,
         last_run, next_run, last_result, last_error)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      this.db.run(sql, [
        schedule.id,
        schedule.certificate_id,
        schedule.cron_expression,
        schedule.days_before_expiry,
        schedule.enabled ? 1 : 0,
        schedule.last_run || null,
        schedule.next_run || null,
        schedule.last_result || null,
        schedule.last_error || null
      ], (err) => {
        if (err) {
          logger.error('Failed to save renewal schedule:', err);
          reject(err);
        } else {
          logger.info(`Renewal schedule saved: ${schedule.id}`);
          resolve();
        }
      });
    });
  }

  /**
   * 获取续期调度
   */
  async getRenewalSchedule(scheduleId: string): Promise<RenewalSchedule | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = 'SELECT * FROM renewal_schedules WHERE id = ?';

      this.db.get(sql, [scheduleId], (err, row: RenewalSchedule) => {
        if (err) {
          logger.error('Failed to get renewal schedule:', err);
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    });
  }

  /**
   * 获取所有续期调度
   */
  async getAllRenewalSchedules(): Promise<RenewalSchedule[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = 'SELECT * FROM renewal_schedules ORDER BY created_at DESC';

      this.db.all(sql, [], (err, rows: RenewalSchedule[]) => {
        if (err) {
          logger.error('Failed to get renewal schedules:', err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * 更新续期调度
   */
  async updateRenewalSchedule(schedule: RenewalSchedule): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        UPDATE renewal_schedules SET
        certificate_id = ?, cron_expression = ?, days_before_expiry = ?, enabled = ?,
        last_run = ?, next_run = ?, last_result = ?, last_error = ?,
        updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      this.db.run(sql, [
        schedule.certificate_id,
        schedule.cron_expression,
        schedule.days_before_expiry,
        schedule.enabled ? 1 : 0,
        schedule.last_run || null,
        schedule.next_run || null,
        schedule.last_result || null,
        schedule.last_error || null,
        schedule.id
      ], (err) => {
        if (err) {
          logger.error('Failed to update renewal schedule:', err);
          reject(err);
        } else {
          logger.info(`Renewal schedule updated: ${schedule.id}`);
          resolve();
        }
      });
    });
  }

  /**
   * 删除续期调度
   */
  async deleteRenewalSchedule(scheduleId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = 'DELETE FROM renewal_schedules WHERE id = ?';

      this.db.run(sql, [scheduleId], (err) => {
        if (err) {
          logger.error('Failed to delete renewal schedule:', err);
          reject(err);
        } else {
          logger.info(`Renewal schedule deleted: ${scheduleId}`);
          resolve();
        }
      });
    });
  }

  /**
   * 更新Agent信息
   */
  async updateAgent(agent: Agent): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        UPDATE agents SET
        hostname = ?, os = ?, nginx_version = ?, nginx_config = ?, version = ?
        WHERE id = ?
      `;

      this.db.run(sql, [
        agent.hostname,
        agent.os,
        agent.nginx_version,
        agent.nginx_config,
        agent.version,
        agent.id
      ], (err) => {
        if (err) {
          logger.error('Failed to update agent:', err);
          reject(err);
        } else {
          logger.info(`Agent updated: ${agent.id}`);
          resolve();
        }
      });
    });
  }

  /**
   * 删除Agent
   */
  async deleteAgent(agentId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = 'DELETE FROM agents WHERE id = ?';

      this.db.run(sql, [agentId], (err) => {
        if (err) {
          logger.error('Failed to delete agent:', err);
          reject(err);
        } else {
          logger.info(`Agent deleted: ${agentId}`);
          resolve();
        }
      });
    });
  }



  /**
   * 保存部署任务
   */
  async saveDeploymentTask(task: Omit<DeploymentTask, 'created_at' | 'updated_at'>): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        INSERT OR REPLACE INTO deployment_tasks
        (id, certificate_id, agent_id, target_type, target_config, status, progress,
         started_at, completed_at, error, logs)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      this.db.run(sql, [
        task.id,
        task.certificate_id,
        task.agent_id,
        task.target_type,
        task.target_config,
        task.status,
        task.progress,
        task.started_at || null,
        task.completed_at || null,
        task.error || null,
        task.logs
      ], (err) => {
        if (err) {
          logger.error('Failed to save deployment task:', err);
          reject(err);
        } else {
          logger.info(`Deployment task saved: ${task.id}`);
          resolve();
        }
      });
    });
  }

  /**
   * 获取部署任务
   */
  async getDeploymentTask(taskId: string): Promise<DeploymentTask | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = 'SELECT * FROM deployment_tasks WHERE id = ?';

      this.db.get(sql, [taskId], (err, row: DeploymentTask) => {
        if (err) {
          logger.error('Failed to get deployment task:', err);
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    });
  }

  /**
   * 获取所有部署任务
   */
  async getAllDeploymentTasks(limit: number = 50, offset: number = 0): Promise<{
    tasks: DeploymentTask[];
    total: number;
  }> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      // 获取总数
      const countSql = 'SELECT COUNT(*) as total FROM deployment_tasks';
      this.db.get(countSql, [], (err, countRow: any) => {
        if (err) {
          logger.error('Failed to count deployment tasks:', err);
          reject(err);
          return;
        }

        // 获取任务列表
        const sql = 'SELECT * FROM deployment_tasks ORDER BY created_at DESC LIMIT ? OFFSET ?';
        this.db!.all(sql, [limit, offset], (err, rows: DeploymentTask[]) => {
          if (err) {
            logger.error('Failed to get deployment tasks:', err);
            reject(err);
          } else {
            resolve({
              tasks: rows || [],
              total: countRow.total || 0
            });
          }
        });
      });
    });
  }

  /**
   * 更新部署任务
   */
  async updateDeploymentTask(task: DeploymentTask): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        UPDATE deployment_tasks SET
        status = ?, progress = ?, started_at = ?, completed_at = ?,
        error = ?, logs = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      this.db!.run(sql, [
        task.status,
        task.progress,
        task.started_at || null,
        task.completed_at || null,
        task.error || null,
        task.logs,
        task.id
      ], (err) => {
        if (err) {
          logger.error('Failed to update deployment task:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * 删除部署任务
   */
  async deleteDeploymentTask(taskId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = 'DELETE FROM deployment_tasks WHERE id = ?';

      this.db.run(sql, [taskId], (err) => {
        if (err) {
          logger.error('Failed to delete deployment task:', err);
          reject(err);
        } else {
          logger.info(`Deployment task deleted: ${taskId}`);
          resolve();
        }
      });
    });
  }

  // ===== User Methods =====

  /**
   * 创建用户
   */
  async createUser(user: { username: string; email: string; password: string; role?: string }): Promise<User> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const id = uuidv4();
      const password_hash = bcrypt.hashSync(user.password, 10);
      const role = user.role || 'user';

      const sql = `
        INSERT INTO users (id, username, email, password_hash, role)
        VALUES (?, ?, ?, ?, ?)
      `;

      this.db.run(sql, [id, user.username, user.email, password_hash, role], (err) => {
        if (err) {
          logger.error('Failed to create user:', err);
          reject(err);
        } else {
          this.getUserById(id).then((u) => resolve(u!)).catch(reject);
        }
      });
    });
  }

  /**
   * 根据用户名查找用户
   */
  async getUserByUsername(username: string): Promise<User | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.get('SELECT * FROM users WHERE username = ?', [username], (err, row: User) => {
        if (err) {
          logger.error('Failed to get user by username:', err);
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    });
  }

  /**
   * 根据邮箱查找用户
   */
  async getUserByEmail(email: string): Promise<User | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.get('SELECT * FROM users WHERE email = ?', [email], (err, row: User) => {
        if (err) {
          logger.error('Failed to get user by email:', err);
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    });
  }

  /**
   * 根据ID查找用户
   */
  async getUserById(id: string): Promise<User | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.get('SELECT * FROM users WHERE id = ?', [id], (err, row: User) => {
        if (err) {
          logger.error('Failed to get user by id:', err);
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    });
  }

  /**
   * 更新用户信息
   */
  async updateUser(id: string, updates: { username?: string; email?: string; avatar?: string }): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const fields: string[] = [];
      const values: any[] = [];

      if (updates.username !== undefined) {
        fields.push('username = ?');
        values.push(updates.username);
      }
      if (updates.email !== undefined) {
        fields.push('email = ?');
        values.push(updates.email);
      }
      if (updates.avatar !== undefined) {
        fields.push('avatar = ?');
        values.push(updates.avatar);
      }

      if (fields.length === 0) {
        resolve();
        return;
      }

      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);

      const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;

      this.db.run(sql, values, (err) => {
        if (err) {
          logger.error('Failed to update user:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * 修改用户密码
   */
  async updateUserPassword(id: string, newPassword: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const password_hash = bcrypt.hashSync(newPassword, 10);

      this.db.run(
        'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [password_hash, id],
        (err) => {
          if (err) {
            logger.error('Failed to update user password:', err);
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  // ===== Payment Order Methods =====

  /**
   * 创建支付订单
   */
  async createPaymentOrder(order: {
    user_id: string;
    order_no: string;
    amount: number;
    payment_method: 'wechat' | 'alipay';
    description: string;
    plan_id?: string;
    pay_url?: string;
  }): Promise<PaymentOrder> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const id = uuidv4();

      const sql = `
        INSERT INTO payment_orders (id, user_id, order_no, amount, payment_method, description, plan_id, pay_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      this.db.run(sql, [
        id,
        order.user_id,
        order.order_no,
        order.amount,
        order.payment_method,
        order.description,
        order.plan_id || null,
        order.pay_url || null
      ], (err) => {
        if (err) {
          logger.error('Failed to create payment order:', err);
          reject(err);
        } else {
          this.getPaymentOrderById(id).then((o) => resolve(o!)).catch(reject);
        }
      });
    });
  }

  /**
   * 获取用户订单列表
   */
  async getPaymentOrdersByUserId(userId: string): Promise<PaymentOrder[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.all(
        'SELECT * FROM payment_orders WHERE user_id = ? ORDER BY created_at DESC',
        [userId],
        (err, rows: PaymentOrder[]) => {
          if (err) {
            logger.error('Failed to get payment orders:', err);
            reject(err);
          } else {
            resolve(rows || []);
          }
        }
      );
    });
  }

  /**
   * 获取订单详情
   */
  async getPaymentOrderById(id: string): Promise<PaymentOrder | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.get('SELECT * FROM payment_orders WHERE id = ?', [id], (err, row: PaymentOrder) => {
        if (err) {
          logger.error('Failed to get payment order:', err);
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    });
  }

  /**
   * 通过订单号获取订单
   */
  async getPaymentOrderByOrderNo(orderNo: string): Promise<PaymentOrder | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.get('SELECT * FROM payment_orders WHERE order_no = ?', [orderNo], (err, row: PaymentOrder) => {
        if (err) {
          logger.error('Failed to get payment order by order_no:', err);
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    });
  }

  /**
   * 更新订单状态
   */
  async updatePaymentOrderStatus(id: string, status: PaymentOrder['status'], paidAt?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        UPDATE payment_orders SET status = ?, paid_at = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      this.db.run(sql, [status, paidAt || null, id], (err) => {
        if (err) {
          logger.error('Failed to update payment order status:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  // ===== Payment Plan Methods =====

  /**
   * 获取所有套餐计划
   */
  async getAllPaymentPlans(): Promise<PaymentPlan[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.all('SELECT * FROM payment_plans ORDER BY price ASC', [], (err, rows: PaymentPlan[]) => {
        if (err) {
          logger.error('Failed to get payment plans:', err);
          reject(err);
        } else {
          const plans = (rows || []).map(p => {
            let features: any = [];
            try {
              features = JSON.parse(p.features || '[]');
            } catch {
              features = [];
            }
            return { ...p, features };
          });
          resolve(plans);
        }
      });
    });
  }

  /**
   * 创建套餐计划
   */
  async createPaymentPlan(plan: Omit<PaymentPlan, 'id' | 'created_at'>): Promise<PaymentPlan> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const id = uuidv4();
      const features = Array.isArray(plan.features) ? JSON.stringify(plan.features) : plan.features;

      const sql = `
        INSERT INTO payment_plans (id, name, description, price, duration_days, features)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      this.db.run(sql, [id, plan.name, plan.description, plan.price, plan.duration_days, features], (err) => {
        if (err) {
          logger.error('Failed to create payment plan:', err);
          reject(err);
        } else {
          this.db!.get('SELECT * FROM payment_plans WHERE id = ?', [id], (e, row: PaymentPlan) => {
            if (e) reject(e);
            else resolve({ ...row, features: JSON.parse(row.features || '[]') });
          });
        }
      });
    });
  }

  /**
   * 初始化默认套餐和管理员账号
   */
  async initDefaultPlans(): Promise<void> {
    // 初始化默认管理员账号
    const existing = await this.getUserByUsername('admin');
    if (!existing) {
      await this.createUser({
        username: 'admin',
        email: 'admin@newhttps.com',
        password: 'admin123',
        role: 'admin'
      });
      logger.info('Default admin user created (admin/admin123)');
    }

    // 初始化默认套餐
    const plans = await this.getAllPaymentPlans();
    if (plans.length === 0) {
      const defaultPlans = [
        {
          name: '免费版',
          description: '适合个人用户和小型项目',
          price: 0,
          duration_days: 365,
          features: JSON.stringify(['管理 5 个证书', '手动续期', '基础监控'])
        },
        {
          name: '专业版',
          description: '适合中小企业和开发团队',
          price: 99,
          duration_days: 365,
          features: JSON.stringify(['管理 50 个证书', '自动续期', '高级监控', '邮件通知', '优先支持'])
        },
        {
          name: '企业版',
          description: '适合大型企业和高并发场景',
          price: 299,
          duration_days: 365,
          features: JSON.stringify(['无限证书', '自动续期', '高级监控', '多渠道通知', '专属支持', 'API 访问'])
        }
      ];

      for (const plan of defaultPlans) {
        await this.createPaymentPlan(plan);
      }
      logger.info('Default payment plans created');
    }
  }

  /**
   * 关闭数据库连接
   */
  async close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            logger.error('Error closing database:', err);
          } else {
            logger.info('Database connection closed');
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
