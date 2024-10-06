// src/aiService.ts

import axios, { AxiosResponse } from 'axios';

// Define interfaces to model the OpenAI API response
interface OpenAIChoice {
  text: string;
}

interface OpenAIResponse {
  choices: OpenAIChoice[];
}

export class AIService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Processes a natural language command using the OpenAI API.
   * @param command - The natural language command to process.
   * @returns A promise that resolves to the processed command response as a string.
   */
  async processCommand(command: string): Promise<string> {
    try {
      const response: AxiosResponse<OpenAIResponse> = await axios.post(
        'https://api.openai.com/v1/engines/davinci/completions',
        {
          prompt: command,
          max_tokens: 60,
          temperature: 0.5,
          n: 1,
          stop: null, // Added trailing comma
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`, // Added trailing comma
          },
        },
      );

      if (this.isValidOpenAIResponse(response.data)) {
        return response.data.choices[0].text.trim();
      } else {
        throw new Error('Invalid response structure from OpenAI API.');
      }
    } catch (error) {
      // Handle errors appropriately
      if (axios.isAxiosError(error)) {
        // Axios-specific error handling
        const status = error.response?.status;
        const statusText = error.response?.statusText;
        throw new Error(
          `OpenAI API request failed: ${status ?? 'Unknown Status'} ${statusText ?? ''}`,
        );
      } else if (error instanceof Error) {
        // Generic error handling
        throw new Error(`An unexpected error occurred: ${error.message}`);
      } else {
        // Unknown error type
        throw new Error('An unknown error occurred.');
      }
    }
  }

  /**
   * Handles the response from the OpenAI API.
   * @param response - The response object from the OpenAI API.
   * @returns The processed response as a string.
   */
  handleResponse(response: OpenAIResponse): string {
    if (this.isValidOpenAIResponse(response)) {
      return response.choices[0].text.trim();
    } else {
      throw new Error('Invalid response structure received.');
    }
  }

  /**
   * Validates the structure of the OpenAI API response.
   * @param data - The data to validate.
   * @returns True if the data conforms to OpenAIResponse, otherwise false.
   */
  private isValidOpenAIResponse(data: unknown): data is OpenAIResponse {
    if (
      typeof data === 'object' &&
      data !== null &&
      'choices' in data &&
      Array.isArray((data as OpenAIResponse).choices) &&
      (data as OpenAIResponse).choices.length > 0 &&
      typeof (data as OpenAIResponse).choices[0].text === 'string'
    ) {
      return true;
    }
    return false;
  }

  /**
   * Example method that demonstrates handling of a specific command.
   * @param command - The command to handle.
   * @returns The result of handling the command.
   */
  async handleCommand(command: string): Promise<string> {
    const processedCommand = await this.processCommand(command);
    // Implement your logic to map the processed command to a device action
    // For example:
    // if (processedCommand.includes('turn on the living room lights')) {
    //   this.controlDevice('Living Room Light', true);
    // }

    // Placeholder for actual device control implementation
    return processedCommand;
  }
}
