import { NextResponse } from 'next/server';
import * as os from 'os';

export async function GET() {
  const interfaces = os.networkInterfaces();
  const discoveredInterfaces = [];

  for (const [name, nets] of Object.entries(interfaces)) {
    for (const net of nets) {
      if (net.family === 'IPv4' && !net.internal) {
        discoveredInterfaces.push({
          name: net.name || name,
          interface: name,
          address: net.address,
          netmask: net.netmask,
          mac: net.mac,
          cidr: net.cidr,
        });
      }
    }
  }

  // Generate simulated local devices for demo
  const baseIP = discoveredInterfaces.length > 0 ? discoveredInterfaces[0].address : '192.168.1.1';
  const subnet = baseIP.split('.').slice(0, 3).join('.');

  const simulatedDevices = [];
  const vendors = ['Cisco', 'Huawei', 'Nokia', 'Juniper', 'Ericsson'];
  const types = ['Router', 'Switch', 'Firewall', 'Server', 'Access Point', 'Gateway'];

  for (let i = 1; i <= 20; i++) {
    const ip = `${subnet}.${i + 1}`;
    simulatedDevices.push({
      hostname: `device-${String(i).padStart(3, '0')}.local`,
      ipAddress: ip,
      vendor: vendors[i % vendors.length],
      elementType: types[i % types.length],
      status: i <= 15 ? 'active' : i <= 18 ? 'inactive' : 'maintenance',
      macAddress: `AA:BB:CC:DD:${String(i).padStart(2, '0')}:${String(i + 10).padStart(2, '0')}`,
      responseTimeMs: Math.floor(Math.random() * 5) + 1,
    });
  }

  return NextResponse.json({
    success: true,
    interfaces: discoveredInterfaces,
    gateway: baseIP,
    subnet,
    discoveredDevices: simulatedDevices,
    totalDevices: simulatedDevices.length,
    activeDevices: simulatedDevices.filter(d => d.status === 'active').length,
    scanTime: '2.3s',
    timestamp: new Date().toISOString(),
  });
}
