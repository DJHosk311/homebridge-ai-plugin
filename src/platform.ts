import {
  API,
  APIEvent,
  Characteristic,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
} from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';

import { AIService } from './aiService'; // Import the AI Service
import express, { Request, Response } from 'express'; // Import Express.js and types
import bodyParser from 'body-parser'; // Import Body Parser

/**
 * ExampleHomebridgePlatform
 * This class is the main constructor for your plugin.
 */
export class  HomebridgeAIPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  // This is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  private aiService!: AIService; // AI Service instance with definite assignment assertion

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;

    this.log.debug('Finished initializing platform:', this.config.name);

    // When this event is fired, it means Homebridge has restored all cached accessories from disk.
    this.api.on(APIEvent.DID_FINISH_LAUNCHING, () => {
      this.log.debug('Executed didFinishLaunching callback');

      // Initialize AI Service after collecting device information
      const devicesInfo = this.getAllDevicesInfo();
      this.aiService = new AIService(this.config.apiKey, devicesInfo);

      // Start the AI Service
      this.startAIService();

      // Start HTTP server for command input
      this.startHttpServer();
    });

    // Note: The 'didRegisterAccessory' event is not available in the Homebridge API
    // If needed, handle new accessories in another way
  }

  /**
   * This function is invoked when Homebridge restores cached accessories from disk at startup.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // Collect device information
    const deviceInfo = {
      name: accessory.displayName,
      services: accessory.services.map((service) => ({
        serviceName: service.displayName || 'Unknown Service',
        serviceType: service.UUID,
        characteristics: service.characteristics.map((characteristic) => ({
          characteristicName:
            characteristic.displayName || 'Unknown Characteristic',
          characteristicType: characteristic.UUID,
        })),
      })),
    };

    // Store device information in accessory.context
    accessory.context.deviceInfo = deviceInfo;

    // Add to accessories array
    this.accessories.push(accessory);
  }

  /**
   * Collects information about all accessories.
   */
  private getAllDevicesInfo(): any[] {
    return this.accessories.map((accessory) => accessory.context.deviceInfo);
  }

  /**
   * Starts the AI Service to handle user commands.
   */
  private startAIService() {
    // For testing purposes, we'll simulate a user command
    // In a real-world scenario, you would receive commands dynamically
    setTimeout(() => {
      this.handleUserCommand('Please turn on the living room lights');
    }, 5000); // Delay to ensure Homebridge is fully initialized
  }

  /**
   * Handles user commands by processing them with the AI service.
   */
  public async handleUserCommand(command: string) {
    try {
      const actionData = await this.aiService.processCommand(command);
      await this.executeAction(actionData);
    } catch (error: any) {
      this.log.error('Error processing command:', error.message);
    }
  }

  /**
   * Executes the action returned by the AI service.
   */
  public async executeAction(actionData: { action: string; device: string }) {
    const { action, device } = actionData;

    // Find the accessory by matching the device name
    const accessory = this.findAccessoryByName(device);

    if (accessory) {
      // Perform the action on the accessory
      this.log.info(`Executing '${action}' on '${device}'`);

      // Access the accessory's service
      const service = accessory.services.find(
        (s) =>
          s.displayName.toLowerCase() === device.toLowerCase(),
      );

      if (service) {
        // Determine the characteristic to control based on the service type
        const characteristic = this.getCharacteristicForService(service);

        if (characteristic) {
          // Determine the value to set based on the action
          const value = this.determineValueForAction(action, characteristic);

          if (value !== null) {
            // Set the new value
            characteristic.setValue(value);

            // Access the current value
            const currentValue = characteristic.value;
            this.log.info(`The ${device} is now set to ${currentValue}`);
          } else {
            this.log.error('Could not determine value for action:', action);
          }
        } else {
          this.log.error('Characteristic not found for service:', service.displayName);
        }
      } else {
        this.log.error('Service not found on accessory:', device);
      }
    } else {
      this.log.error('Accessory not found:', device);
    }
  }

  /**
   * Finds an accessory by its display name.
   */
  private findAccessoryByName(name: string): PlatformAccessory | undefined {
    // Search in cached accessories
    const accessory = this.accessories.find(
      (acc) => acc.displayName.toLowerCase() === name.toLowerCase(),
    );

    return accessory;
  }

  /**
   * Determines the characteristic to control based on the service type.
   */
  private getCharacteristicForService(service: Service): Characteristic | undefined {
    if (service instanceof this.Service.Lightbulb || service instanceof this.Service.Switch) {
      return service.getCharacteristic(this.Characteristic.On);
    }
    if (service instanceof this.Service.Thermostat) {
      return service.getCharacteristic(this.Characteristic.TargetTemperature);
    }
    if (service instanceof this.Service.Fan) {
      return service.getCharacteristic(this.Characteristic.On);
    }
    if (service instanceof this.Service.Outlet) {
      return service.getCharacteristic(this.Characteristic.On);
    }
    // Add more service types as needed
    return undefined;
  }

  /**
   * Determines the value to set based on the action and characteristic.
   */
  private determineValueForAction(action: string, characteristic: Characteristic): any {
    const actionLower = action.toLowerCase();

    if (characteristic.UUID === this.Characteristic.On.UUID) {
      if (actionLower.includes('turn on') || actionLower.includes('switch on')) {
        return true;
      }
      if (actionLower.includes('turn off') || actionLower.includes('switch off')) {
        return false;
      }
    }

    if (characteristic.UUID === this.Characteristic.TargetTemperature.UUID) {
      const matches = actionLower.match(/set.*temperature.*to (\d+)/);
      if (matches && matches[1]) {
        return parseInt(matches[1], 10);
      }
    }

    // Add more action parsing as needed

    return null;
  }

  /**
   * Starts an HTTP server to receive commands.
   */
  private startHttpServer() {
    const app = express();
    app.use(bodyParser.json());

    app.post('/command', async (req: Request, res: Response) => {
      const command = req.body.command;
      this.log.info('Received command:', command);

      try {
        await this.handleUserCommand(command);
        res.status(200).send('Command executed successfully.');
      } catch (error: any) {
        this.log.error('Error executing command:', error.message);
        res.status(500).send('Error executing command.');
      }
    });

    const port = 3000;
    app.listen(port, () => {
      this.log.info(`HTTP server running on port ${port}`);
    });
  }
}
