// src/platform.ts

import {
  API,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
  Characteristic,
} from 'homebridge';

import { PLATFORM_NAME } from './settings';
import { ExamplePlatformAccessory } from './platformAccessory';
import { AIService } from './aiService';

// Define interfaces to model data structures
interface DeviceConfig {
  name: string;
  type: string;
  // Add other device-specific configurations here
}

interface PlatformConfigExtended extends PlatformConfig {
  devices: DeviceConfig[];
  apiKey: string;
}

export class HomebridgeAIPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  private readonly accessories: PlatformAccessory[] = [];
  private aiService: AIService;

  /**
   * Initializes the platform with the provided logger, configuration, and Homebridge API.
   * @param log - The Homebridge logger instance.
   * @param config - The platform configuration from config.json.
   * @param api - The Homebridge API instance.
   */
  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', PLATFORM_NAME);

    // Initialize AIService with the provided API key
    const platformConfig = config as PlatformConfigExtended;
    this.aiService = new AIService(platformConfig.apiKey);

    this.api.on('didFinishLaunching', () => {
      this.log.debug('Executed didFinishLaunching callback');
      this.discoverDevices();
    });
  }

  /**
   * Configures an accessory that was previously cached.
   * @param accessory - The cached platform accessory.
   */
  configureAccessory(accessory: PlatformAccessory): void {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.push(accessory);
  }

  /**
   * Discovers and registers devices defined in the platform configuration.
   */
  private discoverDevices(): void {
    const platformConfig = this.config as PlatformConfigExtended;

    if (!platformConfig.devices || platformConfig.devices.length === 0) {
      this.log.warn('No devices found in the configuration.');
      return;
    }

    for (const device of platformConfig.devices) {
      const uuid = this.api.hap.uuid.generate(device.name);
      const existingAccessory = this.accessories.find(
        (accessory) => accessory.UUID === uuid,
      );

      if (existingAccessory) {
        this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
        new ExamplePlatformAccessory(this, existingAccessory, device);
      } else {
        this.log.info('Adding new accessory:', device.name);
        const accessory = new this.api.platformAccessory(device.name, uuid);

        new ExamplePlatformAccessory(this, accessory, device);

        this.api.registerPlatformAccessories(PLATFORM_NAME, 'HomebridgeAIPlatform', [accessory]);
      }
    }
  }

  /**
   * Processes a natural language command to control devices.
   * @param command - The natural language command.
   */
  public async processCommand(command: string): Promise<void> {
    try {
      this.log.info(`Processing command: "${command}"`);
      const aiResponse = await this.aiService.processCommand(command);
      this.log.info(`AI Response: "${aiResponse}"`);

      // Implement logic to map AI response to device actions
      // For example:
      // if (aiResponse.includes('turn on the living room lights')) {
      //   this.controlDevice('Living Room Light', true);
      // }

      // Placeholder for actual device control implementation
      this.log.info('Command processing logic to be implemented.');
    } catch (error) {
      this.log.error('Error processing command:', (error as Error).message);
    }
  }

  /**
   * Controls a specific device by name.
   * @param deviceName - The name of the device to control.
   * @param state - The desired state of the device (e.g., true for on, false for off).
   */
  private controlDevice(deviceName: string, state: boolean): void {
    const accessory = this.accessories.find(
      (acc) => acc.displayName.toLowerCase() === deviceName.toLowerCase(),
    );

    if (accessory) {
      const service = accessory.getService(this.Service.Lightbulb);
      if (service) {
        service.updateCharacteristic(this.Characteristic.On, state);
        this.log.info(`Set "${deviceName}" to ${state ? 'ON' : 'OFF'}.`);
      } else {
        this.log.warn(`Service for "${deviceName}" not found.`);
      }
    } else {
      this.log.warn(`Accessory "${deviceName}" not found.`);
    }
  }
}
