import { Configuration, OpenAIApi } from 'openai';

export class AIService {
  private openai: OpenAIApi;
  private devicesInfo: any[];

  constructor(apiKey: string, devicesInfo: any[]) {
    const configuration = new Configuration({
      apiKey: apiKey,
    });
    this.openai = new OpenAIApi(configuration);

    this.devicesInfo = devicesInfo;
  }

  async processCommand(command: string): Promise<{ action: string; device: string }> {
    const prompt = `
You are an AI assistant for a smart home system. The user has the following devices:

${JSON.stringify(this.devicesInfo, null, 2)}

Your task is to interpret user commands given in everyday language and output a JSON object with two properties: "action" and "device".

Instructions:

- "action": The intended action, such as "turn on", "turn off", "set temperature to", etc.
- "device": The name of the device or appliance the user wants to control.
- Use the device information provided to understand what the user is referring to.

Please interpret the following command and output only the JSON object without any additional text:

"${command}"
`;

    const response = await this.openai.createCompletion({
      model: 'text-davinci-003',
      prompt: prompt,
      max_tokens: 150,
      temperature: 0,
      stop: ['\n\n'],
    });

    const result = response.data?.choices?.[0]?.text?.trim();

    if (!result) {
      throw new Error('No response from AI');
    }

    try {
      return JSON.parse(result);
    } catch (error: any) {
      throw new Error(`Failed to parse AI response: ${result}`);
    }
  }

  public updateDevicesInfo(devicesInfo: any[]) {
    this.devicesInfo = devicesInfo;
  }
}
