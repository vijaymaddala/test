import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatRadioModule } from '@angular/material/radio';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HeadlessRecordingService } from '../../services/headless-recording.service';
import { TestGeneratorService, TestFramework, GeneratedTest } from '../../services/test-generator.service';
import { TestExecutionComponent } from '../test-execution/test-execution';
import { TestSession, UserAction, NetworkCall } from '../../models/test-recording.model';
import { ResponseDetectionService, ChatbotResponse } from '../../services/response-detection.service';
import { ChatbotContextDetectionService, ChatbotContext } from '../../services/chatbot-context-detection.service';
import { SimpleResponseValidatorService, ValidationCheck } from '../../services/simple-response-validator.service';
import { SavedTestCasesService, TestStep } from '../../services/saved-test-cases.service';
import { AuthService } from '../../services/auth.service';
import { ProjectTemplateService } from '../../services/project-template.service';
import { RecordingService, SaveRecordingRequest, RecordingAction } from '../../services/recording.service';

@Component({
  selector: 'app-test-recording-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatChipsModule,
    MatCheckboxModule,
    MatExpansionModule,
    MatListModule,
    MatDividerModule,
    MatTooltipModule,
    MatSelectModule,
    MatRadioModule,
    TestExecutionComponent
  ],
  templateUrl: './test-recording-page.html',
  styleUrl: './test-recording-page.scss'
})
export class TestRecordingPageComponent implements OnInit, OnDestroy {
  private headlessRecordingService = inject(HeadlessRecordingService);
  private testGeneratorService = inject(TestGeneratorService);
  private responseDetectionService = inject(ResponseDetectionService);
  private chatbotContextDetectionService = inject(ChatbotContextDetectionService);
  private simpleValidatorService = inject(SimpleResponseValidatorService);
  private savedTestCasesService = inject(SavedTestCasesService);
  private authService = inject(AuthService);
  private projectTemplateService = inject(ProjectTemplateService);
  private recordingService = inject(RecordingService);
  private snackBar = inject(MatSnackBar);
  private cdr = inject(ChangeDetectorRef);
  
  // Test Generation
  availableFrameworks: TestFramework[] = this.testGeneratorService.frameworks.filter(framework => framework.id !== 'selenium');
  selectedFrameworks: string[] = ['cypress', 'playwright']; // Default selections
  generatedTests: GeneratedTest[] = [];
  showTestGeneration = false;
  isSavingTest = false;
  isSavingRecording = false;
  
  // Browser Selection
  selectedBrowser: 'chromium' | 'firefox' | 'webkit' = 'chromium';
  availableBrowsers = [
    { id: 'chromium', name: 'Chrome/Chromium', icon: 'web', description: 'Default browser for recording' },
    { id: 'firefox', name: 'Firefox', icon: 'web', description: 'Mozilla Firefox browser' },
    { id: 'webkit', name: 'Safari/WebKit', icon: 'web', description: 'Safari-based browser' }
  ];
  
  // localStorage keys
  private readonly STORAGE_KEY_TESTS = 'generated_tests_cache';
  private readonly STORAGE_KEY_RECORDING = 'current_recording_cache';
  private readonly STORAGE_KEY_CHATBOT = 'chatbot_interactions_cache';
  
  // Recording mode - headless is now default
  currentSessionId: string | null = null;
  useHeadlessMode = true;
  
  // Recording state
  isRecording = false;
  isLoading = false;
  currentRecording: TestSession | null = null;
  recordedActions: UserAction[] = [];
  networkCalls: NetworkCall[] = [];
  isResumedSession = false;
  originalActionsCount = 0;
  
  // External recording
  isExternalRecording = false;
  isExternalSiteLimited = false;
  externalUrl = '';
  externalWindow: Window | null = null;
  
  // Track processed actions to avoid re-processing
  private lastProcessedActionCount = 0;
  
  // Track which input actions have been matched to responses
  private matchedInputTimestamps = new Set<number>();
  
  // Statistics
  totalActions = 0;
  totalNetworkCalls = 0;
  
  // Chatbot context detection
  detectedChatbotContext: ChatbotContext | null = null;
  detectedResponses: ChatbotResponse[] = [];

  // Simple Chatbot Validation
  chatbotInteractions: Array<{
    userQuery: string;
    botResponse: string;
    validation?: ValidationCheck;
    timestamp: number;
    source?: 'api' | 'dom' | 'websocket' | 'mutation';
    apiEndpoint?: string;
    fullResponse?: any;
    responseTime?: number;
    metadata?: Record<string, any>;
  }> = [];
  lastUserInput = ''; // Track the last user input for validation

  // Credential Management
  credentialsExpanded = false;
  credentialsLoading = false;
  hasStoredCredentials = false;
  credentialCount = 0;
  credentialHandlingPreference: 'environment' | 'recorded' = 'environment'; // Default to secure option
  
  // Dynamic credential fields
  credentialFields: Array<{
    name: string;
    value: string;
    type: 'username' | 'password' | 'email' | 'token' | 'code' | 'text';
    showValue?: boolean;
    validation?: any;
  }> = [
    { name: 'username', value: '', type: 'username' },
    { name: 'password', value: '', type: 'password', showValue: false }
  ];

  // Session credentials data
  private sessionCredentials: any = null;

  // Display Options
  displayOptionsExpanded = false;
  selectedLayout: 'compact' | 'detailed' | 'split' = 'detailed';
  showTimestamps = true;
  showActionTypes = true;
  showValidations = true;
  showNetworkCalls = true;
  autoExpandResults = false;
  highlightErrors = true;
  showCredentialHandling = false;
  showLoginCredentials = false;

  /**
   * Toggle display options panel
   */
  toggleDisplayOptionsExpanded(): void {
    this.displayOptionsExpanded = !this.displayOptionsExpanded;
  }

  /**
   * Converts technical action data into human-friendly descriptions
   */
  getHumanFriendlyActionDescription(action: UserAction): string {
    const elementDesc = this.getElementDescription(action.element);
    
    switch (action.type) {
      case 'click':
        return `Click on ${elementDesc}`;
      
      case 'input':
        const inputValue = action.data?.value ? `"${action.data.value}"` : 'text';
        return `Type ${inputValue} into ${elementDesc}`;
      
      case 'navigation':
        const url = action.data?.url ? new URL(action.data.url).hostname : 'page';
        return `Navigate to ${url}`;
      
      case 'scroll':
        const direction = this.getScrollDirection(action.data?.scrollPosition);
        return `Scroll ${direction} on the page`;
      
      case 'hover':
        return `Hover over ${elementDesc}`;
      
      case 'keypress':
        const key = action.data?.key || 'key';
        return `Press ${key} key`;
      
      case 'form_submit':
        return `Submit form containing ${elementDesc}`;
      
      default:
        return `Perform ${action.type} on ${elementDesc}`;
    }
  }

  /**
   * Gets a human-friendly element description
   */
  private getElementDescription(element: any): string {
    // If element has text content, use it
    if (element.text && element.text.trim()) {
      const truncatedText = element.text.length > 30 
        ? element.text.substring(0, 30) + '...' 
        : element.text;
      return `"${truncatedText}"`;
    }

    // Use element attributes to create meaningful description
    const attrs = element.attributes || {};
    
    // Check for common meaningful attributes
    if (attrs.placeholder) {
      return `${this.getElementType(element.tagName)} with placeholder "${attrs.placeholder}"`;
    }
    
    if (attrs['aria-label']) {
      return `${this.getElementType(element.tagName)} labeled "${attrs['aria-label']}"`;
    }
    
    if (attrs.title) {
      return `${this.getElementType(element.tagName)} titled "${attrs.title}"`;
    }
    
    if (attrs.name) {
      return `${this.getElementType(element.tagName)} named "${attrs.name}"`;
    }
    
    if (attrs.id) {
      return `${this.getElementType(element.tagName)} with ID "${attrs.id}"`;
    }
    
    if (attrs.class) {
      const classList = attrs.class.split(' ');
      const meaningfulClass = classList.find((cls: string) => 
        cls.includes('button') || cls.includes('input') || cls.includes('link') || 
        cls.includes('menu') || cls.includes('nav') || cls.includes('search')
      );
      if (meaningfulClass) {
        return `${this.getElementType(element.tagName)} with class "${meaningfulClass}"`;
      }
    }
    
    // Fallback to element type
    return this.getElementType(element.tagName);
  }

  /**
   * Converts HTML tag names to human-friendly element types
   */
  private getElementType(tagName: string): string {
    const typeMap: Record<string, string> = {
      'input': 'input field',
      'button': 'button',
      'a': 'link',
      'div': 'section',
      'span': 'text element',
      'p': 'paragraph',
      'h1': 'main heading',
      'h2': 'heading',
      'h3': 'heading',
      'h4': 'heading',
      'h5': 'heading',
      'h6': 'heading',
      'img': 'image',
      'form': 'form',
      'select': 'dropdown menu',
      'textarea': 'text area',
      'label': 'label',
      'li': 'list item',
      'ul': 'list',
      'ol': 'numbered list',
      'nav': 'navigation menu',
      'header': 'header section',
      'footer': 'footer section',
      'main': 'main content area',
      'aside': 'sidebar',
      'article': 'article',
      'section': 'section',
      'table': 'table',
      'tr': 'table row',
      'td': 'table cell',
      'th': 'table header',
      'iframe': 'embedded content',
      'video': 'video player',
      'audio': 'audio player',
      'canvas': 'canvas element',
      'svg': 'graphic element'
    };
    
    return typeMap[tagName?.toLowerCase()] || `${tagName || 'element'}`;
  }

  /**
   * Determines scroll direction from scroll position data
   */
  private getScrollDirection(scrollPosition?: { x: number; y: number }): string {
    if (!scrollPosition) return 'on the page';
    
    const { x, y } = scrollPosition;
    if (Math.abs(y) > Math.abs(x)) {
      return y > 0 ? 'down' : 'up';
    } else {
      return x > 0 ? 'right' : 'left';
    }
  }

  /**
   * Gets action type icon for better visual representation
   */
  getActionTypeIcon(actionType: string): string {
    const iconMap: Record<string, string> = {
      'click': 'touch_app',
      'input': 'keyboard',
      'navigation': 'navigation',
      'scroll': 'swap_vert',
      'hover': 'mouse',
      'keypress': 'keyboard',
      'form_submit': 'send'
    };
    
    return iconMap[actionType] || 'action';
  }

  /**
   * Checks if this action will trigger response validation when tests are generated
   */
  willTriggerValidation(action: UserAction, index: number): boolean {
    // Chatbot validation is now always enabled via backend Puppeteer
    // Input actions that contain text will trigger validation
    if (action.type === 'input' && action.data?.value) {
      return true;
    }

    // Click actions on send/submit buttons will trigger validation
    if (action.type === 'click') {
      const selector = action.element?.selector || '';
      const isSendButton = selector.includes('send') || 
                        selector.includes('submit') || 
                        selector.includes('button') ||
                        action.element?.tagName?.toLowerCase() === 'button';
      return isSendButton;
    }

    return false;
  }

  /**
   * Gets the validation status description for an action
   */
  getValidationStatusDescription(action: UserAction, index: number): string {
    // Chatbot validation is now always enabled
    if (this.willTriggerValidation(action, index)) {
      if (action.type === 'input') {
        const query = action.data?.value || '';
        const context = this.getValidationContext(query);
        return `Will validate response for: "${query}"${context ? ` (${context} context)` : ''}`;
      } else if (action.type === 'click') {
        return 'Will validate response after this action';
      }
    }

    return '';
  }

  /**
   * Detects the validation context from user input
   */
  private getValidationContext(query: string): string {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.match(/\b[A-Z]{2,5}\b/) || lowerQuery.includes('stock') || lowerQuery.includes('price')) {
      return 'stock/financial';
    }
    if (lowerQuery.includes('weather') || lowerQuery.includes('temperature')) {
      return 'weather';
    }
    if (lowerQuery.includes('company') || lowerQuery.includes('business')) {
      return 'business info';
    }
    if (lowerQuery.includes('location') || lowerQuery.includes('address')) {
      return 'location';
    }
    
    return '';
  }

  /**
   * Counts how many recorded actions will trigger validation
   */
  getValidationActionsCount(): number {
    if (!this.recordedActions) {
      return 0;
    }

    return this.recordedActions.filter((action, index) => 
      this.willTriggerValidation(action, index)
    ).length;
  }

  /**
   * Checks if a generated test contains response validation code
   */
  hasValidationInTest(test: GeneratedTest): boolean {
    return test.code.includes('Response Validation') || 
           test.code.includes('cy.wait') || 
           test.code.includes('expect(');
  }

  ngOnInit() {
    // Load saved tests from localStorage on page load
    this.loadGeneratedTestsFromStorage();
    
    // Debug authentication state on init
    setTimeout(() => {
      const currentUser = this.authService.getCurrentUser();
      const isAuthenticated = this.authService.isLoggedIn();
      console.log('🔍 [INIT] Authentication state check:');
      console.log('  - User:', currentUser?.email || 'None');
      console.log('  - Authenticated:', isAuthenticated);
      console.log('  - Token in localStorage:', !!localStorage.getItem('smart_analyzer_token'));
      console.log('  - User in localStorage:', !!localStorage.getItem('smart_analyzer_user'));
      
      if (!isAuthenticated) {
        console.log('💡 [INIT] No authentication found. Use setupTestUser() method to test save functionality.');
      }
    }, 1000);
    
    // Make component globally accessible for testing console commands (DEV ONLY)
    if (typeof window !== 'undefined') {
      (window as any).testRecordingComponent = this;
    }
    
    // Subscribe to recording updates from both services
    // Subscribe to headless recording updates (now the default mode)
    this.headlessRecordingService.getRecordingSessions().subscribe(sessions => {
      this.currentRecording = sessions.length > 0 ? sessions[sessions.length - 1] : null;
      this.updateStatistics();
    });

    this.headlessRecordingService.getIsRecording().subscribe(isRecording => {
      this.isRecording = isRecording;
    });

    // Subscribe to validation services
    this.responseDetectionService.getResponses().subscribe(responses => {

    });

    this.responseDetectionService.getNewResponses().subscribe(response => {
      this.detectedResponses.push(response);

    });

    this.chatbotContextDetectionService.getCurrentContext().subscribe(context => {
      this.detectedChatbotContext = context;
      if (context) {

      }
    });

    // Monitor actions to detect chatbot interactions
    this.headlessRecordingService.getRecordingSessions().subscribe(sessions => {
      if (sessions.length > 0) {
        const currentSession = sessions[sessions.length - 1];
        this.monitorChatbotInteractions(currentSession.actions);
      }
    });
    
    // Listen for chatbot responses from external windows via postMessage
    this.setupChatbotMessageListener();
  }
  
  /**
   * Setup listener for chatbot responses from external windows
   */
  private setupChatbotMessageListener(): void {
    window.addEventListener('message', (event) => {
      // Security check - only accept from localhost in development
      if (!event.origin.includes('localhost')) {
        return;
      }
      
      if (event.data.type === 'chatbot_response') {

        
        const { userQuery, botResponse, timestamp } = event.data;
        
        // Chatbot validation is always enabled
        if (userQuery && botResponse) {

          this.validateChatbotResponse(
            userQuery,
            botResponse,
            'dom',
            undefined,
            { fromExternalWindow: true, viaPostMessage: true, receivedAt: Date.now() },
            timestamp ? Date.now() - timestamp : undefined
          );
        }
      }
    });
    

  }

  /**
   * Monitors recorded actions for chatbot interactions and validates responses
   */
  private monitorChatbotInteractions(actions: UserAction[]): void {
    // For now, just store the last user input for matching with backend responses
    // The actual validation happens in processCapturedChatbotResponses()
    actions.forEach((action, index) => {
      if (action.type === 'input' && action.data?.value) {
        this.lastUserInput = action.data.value;
      }
    });
  }
  
  /**
   * ❌ DISABLED: Old method that was matching user inputs as bot responses
   * Backend Puppeteer system now handles all response capture correctly
   */
  private checkForBotResponseInNextActions(actions: UserAction[], inputIndex: number): void {
    // DISABLED - was causing incorrect matches like "weather" → "stock price"
    // Backend Puppeteer MutationObserver handles all response capture correctly
  }

  /**
   * Process captured chatbot responses from the backend
   */
  private processedResponseIds = new Set<string>();
  
  private processCapturedChatbotResponses(responses: any[]): void {
    if (!responses || responses.length === 0) {
      return;
    }

    // Sort responses by timestamp to process in chronological order
    const sortedResponses = [...responses].sort((a, b) => a.timestamp - b.timestamp);



    sortedResponses.forEach((response, index) => {

      
      // Skip if already processed
      if (this.processedResponseIds.has(response.id)) {

        return;
      }



      // Try to find the user query that triggered this response
      // Look for the most recent input action before this response
      const userQuery = this.findUserQueryForResponse(response);

      if (userQuery) {
        // Check if we've already validated this exact query-response pair
        const isDuplicate = this.chatbotInteractions.some(
          interaction => 
            interaction.userQuery === userQuery && 
            interaction.botResponse === response.text
        );

        if (isDuplicate) {
          console.warn('⏭️ Skipping duplicate validation for:', { userQuery, response: response.text?.substring(0, 30) });
          this.processedResponseIds.add(response.id);
          return;
        }


        this.validateChatbotResponse(
          userQuery,
          response.text,
          response.source,
          undefined,
          { 
            fromBackend: true, 
            capturedByPuppeteer: true,
            responseTime: response.responseTime 
          },
          response.responseTime
        );
      } else {
        console.warn('⚠️ Could not find matching user query for response');
      }

      this.processedResponseIds.add(response.id);
    });
  }

  /**
   * Find the user query that likely triggered a given response
   */
  private findUserQueryForResponse(response: any): string | null {

    
    // Find ALL input actions before this response (no time limit)
    // We'll use responseTime to find the best match instead of arbitrary time window
    let inputActions = this.recordedActions.filter(
      (action) => action.type === 'input' && 
      action.timestamp < response.timestamp
    );


    inputActions.forEach(action => {
      const timeDiff = response.timestamp - action.timestamp;
      const isMatched = this.matchedInputTimestamps.has(action.timestamp);

    });

    if (inputActions.length === 0) {
      // No inputs before this response - likely an automatic greeting or initial message
      console.warn('⚠️ No input found before response - skipping (likely auto-greeting)');
      return null;
    }

    // First, try to find an unmatched input
    const unmatchedInputs = inputActions.filter(action => 
      !this.matchedInputTimestamps.has(action.timestamp)
    );



    if (unmatchedInputs.length === 0) {
      console.warn('⚠️ No unmatched inputs available - all inputs already used');
      return null;
    }

    // Use ONLY unmatched inputs
    const candidateInputs = unmatchedInputs;

    // Strategy 1: If we have responseTime, use it to find the BEST match
    if (response.responseTime && candidateInputs.length > 1) {

      
      let bestMatch = null;
      let smallestDiff = Infinity;
      
      for (const input of candidateInputs) {
        const inputTimeDiff = response.timestamp - input.timestamp;
        const diff = Math.abs(inputTimeDiff - response.responseTime);
        

        
        if (diff < smallestDiff) {
          smallestDiff = diff;
          bestMatch = input;
        }
      }
      
      if (bestMatch) {
        const bestTimeDiff = response.timestamp - bestMatch.timestamp;

        
        // Mark this input as matched
        this.matchedInputTimestamps.add(bestMatch.timestamp);
        return bestMatch.data?.value || null;
      }
    }
    
    // Strategy 2: No responseTime or only one candidate - use the closest (most recent) input
    const closestInput = candidateInputs[candidateInputs.length - 1];
    const timeDiff = response.timestamp - closestInput.timestamp;
    
    console.log(`   ✅ Using closest input: "${closestInput.data?.value}" (${timeDiff}ms ago)`);
    
    // Mark this input as matched
    this.matchedInputTimestamps.add(closestInput.timestamp);
    
    return closestInput.data?.value || null;
  }

  /**
   * ❌ DISABLED: Real-time DOM detection is redundant with backend Puppeteer
   * Backend captures responses correctly via MutationObserver
   */
  private setupRealtimeResponseDetection(): void {
    // DISABLED - backend Puppeteer handles all response capture
    return;
  }

  /**
   * ❌ DISABLED: Old method that was creating duplicate validations
   * Backend Puppeteer system handles all response detection
   */
  private detectAndValidateBotResponse(recentActions: UserAction[]): void {
    // DISABLED - backend handles this correctly now
    return;
  }

  /**
   * Extracts text from a network response
   */
  private extractResponseText(response: any): string {
    if (typeof response === 'string') {
      return response;
    }
    
    if (response && typeof response === 'object') {
      // Common chatbot response patterns
      return response.message || 
             response.text || 
             response.content || 
             response.reply || 
             response.answer ||
             JSON.stringify(response);
    }
    
    return '';
  }

  /**
   * Validates if bot response is contextually relevant to user query
   */
  private validateChatbotResponse(
    userQuery: string, 
    botResponse: string,
    source?: 'api' | 'dom' | 'websocket' | 'mutation',
    apiEndpoint?: string,
    metadata?: Record<string, any>,
    responseTime?: number
  ): void {
    // Avoid duplicate validations
    const alreadyValidated = this.chatbotInteractions.some(
      interaction => interaction.userQuery === userQuery && interaction.botResponse === botResponse
    );

    if (alreadyValidated) {
      return;
    }

    console.log('🔍 Validating chatbot response...', { source, apiEndpoint });
    
    this.simpleValidatorService.validateResponse(userQuery, botResponse).subscribe(
      validation => {
        const interaction = {
          userQuery,
          botResponse,
          validation,
          timestamp: Date.now(),
          source: source || 'api',
          apiEndpoint: apiEndpoint,
          fullResponse: metadata?.['responseBody'] || metadata?.['responseData'] || botResponse,
          responseTime: responseTime,
          metadata: metadata
        };

        this.chatbotInteractions.push(interaction);
        
        // Trigger change detection to update UI
        this.cdr.detectChanges();
        
        // Log the validation result
        const icon = validation.isRelated ? '✅' : '❌';
        console.log(`${icon} Validation:`, {
          source: source,
          endpoint: apiEndpoint,
          query: userQuery.substring(0, 50),
          response: botResponse.substring(0, 50),
          isRelated: validation.isRelated,
          confidence: validation.confidence,
          reason: validation.reason
        });
        
        console.log('📊 Total validations now:', this.chatbotInteractions.length);
        console.log('📊 All current validations:', this.chatbotInteractions.map((v, i) => ({
          index: i,
          query: v.userQuery.substring(0, 30),
          response: v.botResponse.substring(0, 30)
        })));
      },
      error => {
        console.error('Validation error:', error);
      }
    );
  }

  /**
   * Test method to manually trigger a validation for debugging
   */
  testValidation(): void {
    console.log('🧪 Testing validation manually...');
    console.log('📊 Current chatbotInteractions:', this.chatbotInteractions);
    console.log('📊 Array length BEFORE:', this.chatbotInteractions.length);
    
    this.validateChatbotResponse(
      'What is the weather today?',
      'The weather today is sunny with a temperature of 75°F.',
      'dom',
      undefined,
      { test: true },
      100
    );
    
    // Check after a short delay to see if it was added
    setTimeout(() => {
      console.log('📊 Array length AFTER (delayed check):', this.chatbotInteractions.length);
      console.log('📊 Full array:', JSON.stringify(this.chatbotInteractions, null, 2));
    }, 1000);
  }

  ngOnDestroy() {
    this.stopRecording();
    if (this.externalWindow) {
      try {
        this.externalWindow.close();
      } catch (e) {
        // Ignore cross-origin errors
      }
    }
  }

  async startRecording() {
    // Prevent duplicate recordings
    if (this.isRecording || this.isLoading) {
      console.log('⚠️ Recording already in progress, ignoring duplicate request');
      return;
    }

    // Clear previous recording state
    console.log('🧹 Clearing previous recording state...');
    this.chatbotInteractions = [];
    this.matchedInputTimestamps.clear();
    this.processedResponseIds.clear();
    this.lastProcessedActionCount = 0;
    this.recordedActions = [];
    this.networkCalls = [];
    this.totalActions = 0;
    this.totalNetworkCalls = 0;
    this.generatedTests = [];
    this.showTestGeneration = false;
    console.log('✅ Recording state cleared');

    this.isLoading = true;
    try {
      const session = await this.headlessRecordingService.startRecording('Interactive Browser Test Session', 'https://example.com');
      this.currentSessionId = session.id; // Store session ID for credential-aware test generation
      console.log('Interactive browser recording session started:', session.id);
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert(`Failed to start recording: ${error}`);
    } finally {
      this.isLoading = false;
    }
  }

  async stopRecording() {
    console.log('🛑 Stopping recording - Current chatbotInteractions:', this.chatbotInteractions.length);
    
    await this.headlessRecordingService.stopRecording();
    
    // Clear session ID
    this.currentSessionId = null;
    
    // Stop response detection (always enabled now)
    console.log('🛑 Stopping DOM-based response detection');
    this.responseDetectionService.stopDetection();
    
    // Clear matching state for next recording
    this.matchedInputTimestamps.clear();
    this.processedResponseIds.clear();
    
    console.log('🛑 After stopping - chatbotInteractions:', this.chatbotInteractions.length);
    
    if (this.externalWindow) {
      try {
        this.externalWindow.close();
      } catch (e) {
        // Ignore cross-origin errors
      }
      this.externalWindow = null;
    }
    this.isExternalRecording = false;
  }

  async continueRecording() {
    if (!this.currentRecording) {
      console.error('❌ No existing recording to continue');
      return;
    }

    // ⚠️ CRITICAL: Use currentRecording data which has the latest from polling
    // Adding a small delay to ensure the last polling cycle completed
    console.log('🔄 Preparing to continue recording...');
    this.isLoading = true;
    
    // Wait 500ms to ensure any pending polling has completed
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      // Use the current recording data (already synced by polling)
      const existingActions = [...this.recordedActions];
      const existingNetworkCalls = [...this.networkCalls];
      const existingChatbotInteractions = [...this.chatbotInteractions];
      
      // Mark this as a resumed session and store the original count
      this.isResumedSession = true;
      this.originalActionsCount = existingActions.length;
      
      console.log('🔄 Continuing recording from existing session:', {
        sessionId: this.currentRecording.id,
        existingActions: existingActions.length,
        existingNetworkCalls: existingNetworkCalls.length,
        existingChatbotInteractions: existingChatbotInteractions.length,
        note: 'Using data from current recording after 500ms delay'
      });

      // Use the same URL from the existing recording
      const targetUrl = this.currentRecording.url || this.externalUrl;
      
      // Start a new recording session that will be merged later
      this.isExternalRecording = true;
      this.isExternalSiteLimited = !targetUrl.includes('localhost:4200');
      
      await this.headlessRecordingService.resumeRecording(
        this.currentRecording.id,
        targetUrl,
        true, // interactive mode
        {
          existingActions,
          existingNetworkCalls,
          existingChatbotInteractions
        }
      );
      
      // Note: Response detection will be handled by the polling mechanism
      // as the backend service records responses during the session

      this.isLoading = false;
      console.log('✅ Recording resumed successfully');
    } catch (error) {
      console.error('❌ Failed to continue recording:', error);
      this.isLoading = false;
      this.isExternalRecording = false;
      alert('Failed to continue recording. Please try again.');
    }
  }

  switchToTestTarget() {
    this.stopRecording();
    this.externalUrl = 'http://localhost:4200/test-target';
    this.testExternalRecording();
  }

  clearRecording(): void {
    this.headlessRecordingService.clearRecording();
    this.isResumedSession = false;
    this.originalActionsCount = 0;
    console.log('Recording cleared');
  }

  async testExternalRecording() {
    // Validate URL if provided
    if (this.externalUrl.trim()) {
      if (!this.isValidUrl(this.externalUrl.trim())) {
        alert('Please enter a valid URL with a proper domain (e.g., https://example.com)');
        return;
      }
    } else {
      // Use internal test target page for same-origin recording
      this.externalUrl = 'http://localhost:4200/test-target';
    }

    // Prevent duplicate recordings
    if (this.isRecording || this.isLoading) {
      console.log('⚠️ Recording already in progress, ignoring duplicate request');
      return;
    }

    // Clear previous recording state
    console.log('🧹 Clearing previous recording state...');
    this.chatbotInteractions = [];
    this.matchedInputTimestamps.clear();
    this.processedResponseIds.clear();
    this.lastProcessedActionCount = 0;
    this.recordedActions = [];
    this.networkCalls = [];
    this.totalActions = 0;
    this.totalNetworkCalls = 0;
    this.generatedTests = [];
    this.showTestGeneration = false;
    console.log('✅ Recording state cleared');

    console.log('Starting external recording for:', this.externalUrl);
    this.isExternalRecording = true;
    this.isLoading = true;
    
    // Check if this is likely an external site that will have limitations
    this.isExternalSiteLimited = !this.externalUrl.includes('localhost:4200');
    
    try {
      // Show browser selection info
      if (this.selectedBrowser !== 'chromium') {
        this.snackBar.open(
          `Note: ${this.selectedBrowser.toUpperCase()} support requires Playwright. Falling back to Chromium.`,
          'OK',
          { duration: 5000 }
        );
      }
      
      // Use interactive browser recording (now default)
      console.log('🎬 Starting interactive browser recording for external URL');
      console.log(`🌐 Selected browser: ${this.selectedBrowser}`);
      const session = await this.headlessRecordingService.startRecording('Browser Recording Session', this.externalUrl, {
        browser: this.selectedBrowser
      });
      this.currentSessionId = session.id; // Store session ID for credential-aware test generation
      console.log('Browser recording session started:', session.id);
      
      // START: Enable DOM-based response detection for chatbot validation (always enabled)
      console.log('🤖 Starting DOM-based chatbot response detection');
      this.responseDetectionService.startDetection(window, {
        enableDomDetection: true,
        enableApiDetection: true,
        responseSelectors: [
          // Common chatbot message selectors
          '[class*="message"]',
          '[class*="chat"]',
          '[class*="response"]',
          '[class*="bot"]',
          '[class*="assistant"]',
          '[class*="ai"]',
          '[id*="message"]',
            '[id*="chat"]',
            '[data-message]',
            '[data-bot-response]',
            '.chatbot-message',
            '.ai-response',
            '.bot-reply'
          ],
          minResponseLength: 10,
          debounceTime: 500
        });
        
        // Setup real-time validation
        this.setupRealtimeResponseDetection();
      
    } catch (error) {
      console.error('Failed to start external recording:', error);
      this.isExternalRecording = false;
      alert('Failed to start external recording. Please try again.');
    } finally {
      this.isLoading = false;
    }
  }

  private updateStatistics() {
    if (this.currentRecording) {
      this.totalActions = this.currentRecording.actions.length;
      this.totalNetworkCalls = this.currentRecording.networkCalls.length;
      this.recordedActions = this.currentRecording.actions;
      this.networkCalls = this.currentRecording.networkCalls;
      
      // Process captured chatbot responses from backend
      if (this.currentRecording.chatbotResponses && this.currentRecording.chatbotResponses.length > 0) {
        console.log(`🤖 Processing ${this.currentRecording.chatbotResponses.length} captured chatbot responses from backend`);
        this.processCapturedChatbotResponses(this.currentRecording.chatbotResponses);
      }
      
      // Monitor NEW actions for chatbot interactions (only process actions we haven't seen)
      // Chatbot validation is always enabled
      if (this.recordedActions.length > this.lastProcessedActionCount) {
        console.log(`📊 Processing new actions: ${this.lastProcessedActionCount} -> ${this.recordedActions.length}`);
        this.monitorChatbotInteractions(this.recordedActions);
        this.lastProcessedActionCount = this.recordedActions.length;
      }
    } else {
      this.totalActions = 0;
      this.totalNetworkCalls = 0;
      this.recordedActions = [];
      this.networkCalls = [];
      this.lastProcessedActionCount = 0;
    }
  }

  exportRecording() {
    if (this.hasRecordingData) {
      const exportData = {
        session: this.currentRecording,
        userActions: this.recordedActions,
        networkCalls: this.networkCalls,
        exportedAt: new Date().toISOString()
      };
      
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `test-recording-${new Date().toISOString().slice(0, 10)}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    }
  }

  async saveRecordingToDatabase() {
    if (!this.hasRecordingData) {
      this.snackBar.open('No recording data to save', 'Close', { duration: 3000 });
      return;
    }

    // Prompt for recording name and description
    const name = prompt('Enter a name for this recording:');
    if (!name) {
      return; // User cancelled
    }

    const description = prompt('Enter a description (optional):');
    const tags = prompt('Enter tags separated by commas (optional):');

    this.isSavingRecording = true;

    try {
      // Convert UserActions to RecordingActions
      const actions: RecordingAction[] = this.recordedActions.map(action => ({
        type: action.type as RecordingAction['type'],
        element: {
          selector: action.element?.selector,
          xpath: action.element?.xpath,
          tagName: action.element?.tagName,
          text: action.element?.text,
          attributes: action.element?.attributes,
          position: action.element?.position
        },
        data: action.data,
        timestamp: new Date(action.timestamp)
      }));

      // Calculate metadata
      const browserInfo = await this.getBrowserInfo();
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight
      };

      const recordingRequest: SaveRecordingRequest = {
        name,
        description: description || undefined,
        url: this.currentRecording?.url || this.externalUrl,
        actions,
        metadata: {
          duration: this.currentRecording?.duration,
          actionCount: actions.length,
          browserInfo,
          viewport
        },
        tags: tags ? tags.split(',').map(t => t.trim()).filter(t => t) : undefined
      };

      await this.recordingService.saveRecording(recordingRequest).toPromise();

      this.snackBar.open('Recording saved successfully! View it in Saved Recordings.', 'Close', { 
        duration: 5000 
      });
      
      console.log('✅ Recording saved to database:', name);
    } catch (error) {
      console.error('❌ Failed to save recording:', error);
      this.snackBar.open('Failed to save recording. Please try again.', 'Close', { 
        duration: 5000 
      });
    } finally {
      this.isSavingRecording = false;
    }
  }

  private async getBrowserInfo(): Promise<{ name: string; version: string; platform: string }> {
    const userAgent = navigator.userAgent;
    let browserName = 'Unknown';
    let browserVersion = 'Unknown';

    // Detect browser
    if (userAgent.indexOf('Chrome') > -1) {
      browserName = 'Chrome';
      const match = userAgent.match(/Chrome\/(\d+)/);
      if (match) browserVersion = match[1];
    } else if (userAgent.indexOf('Firefox') > -1) {
      browserName = 'Firefox';
      const match = userAgent.match(/Firefox\/(\d+)/);
      if (match) browserVersion = match[1];
    } else if (userAgent.indexOf('Safari') > -1) {
      browserName = 'Safari';
      const match = userAgent.match(/Version\/(\d+)/);
      if (match) browserVersion = match[1];
    }

    return {
      name: browserName,
      version: browserVersion,
      platform: navigator.platform
    };
  }

  get hasRecordingData(): boolean {
    return this.recordedActions.length > 0 || this.networkCalls.length > 0;
  }

  // Chatbot Validation Helper Methods
  
  /**
   * Gets validation check for a specific action if it's a chatbot interaction
   */
  getValidationForAction(action: UserAction): ValidationCheck | null {
    if (action.type === 'input' && action.data?.value) {
      // Find validation for this user input
      const interaction = this.chatbotInteractions.find(
        i => i.userQuery === action.data?.value
      );
      return interaction?.validation || null;
    }
    return null;
  }

  /**
   * Checks if an action has associated validation
   */
  hasValidation(action: UserAction): boolean {
    return this.getValidationForAction(action) !== null;
  }

  /**
   * Gets validation icon for display
   */
  getValidationIcon(action: UserAction): string {
    const validation = this.getValidationForAction(action);
    if (!validation) return '';
    return validation.isRelated ? 'check_circle' : 'cancel';
  }

  /**
   * Gets validation color for display
   */
  getValidationColor(action: UserAction): string {
    const validation = this.getValidationForAction(action);
    if (!validation) return '';
    return validation.isRelated ? '#4caf50' : '#f44336';
  }

  /**
   * Gets validation tooltip text
   */
  getValidationTooltip(action: UserAction): string {
    const validation = this.getValidationForAction(action);
    if (!validation) return '';
    return `${validation.isRelated ? '✓ Relevant' : '✗ Not Relevant'} (${(validation.confidence * 100).toFixed(0)}%)\n${validation.reason}`;
  }

  /**
   * Checks if there are any failed validations
   */
  hasFailedValidations(): boolean {
    return this.chatbotInteractions.some(i => i.validation && !i.validation.isRelated);
  }

  /**
   * Gets CSS class for chatbot interactions summary
   */
  getChatbotSummaryClass(): string {
    return this.hasFailedValidations() ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200';
  }

  /**
   * Gets icon color for chatbot interactions summary
   */
  getChatbotSummaryIconClass(): string {
    return this.hasFailedValidations() ? 'text-yellow-700' : 'text-green-700';
  }

  /**
   * Gets icon for chatbot interactions summary
   */
  getChatbotSummaryIcon(): string {
    return this.hasFailedValidations() ? 'warning' : 'check_circle';
  }

  /**
   * Gets text color for chatbot interactions summary
   */
  getChatbotSummaryTextClass(): string {
    return this.hasFailedValidations() ? 'text-yellow-800' : 'text-green-800';
  }

  // Network call filtering methods
  getApiCalls(): NetworkCall[] {
    return this.networkCalls.filter(call => 
      call.type === 'api_request' || call.type === 'api_response'
    );
  }

  getAssetFailures(): NetworkCall[] {
    return this.networkCalls.filter(call => call.type === 'asset_failed');
  }

  getApiFailures(): NetworkCall[] {
    return this.networkCalls.filter(call => call.type === 'api_failed');
  }

  getStatusClass(status: number): string {
    if (status >= 200 && status < 300) {
      return 'bg-green-200 text-green-800';
    } else if (status >= 300 && status < 400) {
      return 'bg-yellow-200 text-yellow-800';
    } else if (status >= 400 && status < 500) {
      return 'bg-red-200 text-red-800';
    } else if (status >= 500) {
      return 'bg-red-300 text-red-900';
    }
    return 'bg-gray-200 text-gray-800';
  }

  getMethodClass(method: string): string {
    const methodLower = method.toLowerCase();
    return `method-${methodLower}`;
  }

  // Test Generation Methods
  async generateTests(): Promise<void> {
    if (!this.currentRecording) return;
    
    console.log('🔧 Generating tests with chatbotInteractions:', this.chatbotInteractions.length);
    console.log('🔧 Current session ID:', this.currentSessionId);
    console.log('🔧 Credential handling preference:', this.credentialHandlingPreference);
    
    // Respect user's credential handling preference
    if (this.credentialHandlingPreference === 'environment') {
      // User wants environment variables - use backend generation if credentials are available
      if (this.currentSessionId && this.sessionCredentials && Object.keys(this.sessionCredentials.credentials || {}).length > 0) {
        console.log('🔐 Using backend generation with stored credentials for session:', this.currentSessionId);
        await this.generateTestsWithCredentials();
      } else {
        console.log('🔧 Using client-side generation with environment variables (no stored credentials)');
        this.generateTestsClientSide({ useEnvironmentVariables: true });
      }
    } else {
      // User wants recorded values - always use client-side generation with plain text
      console.log('📝 Using client-side generation with recorded values (as requested by user)');
      this.generateTestsClientSide({ useEnvironmentVariables: false });
    }
  }

  /**
   * Generate tests using the backend service with credential support
   */
  private async generateTestsWithCredentials(): Promise<void> {
    if (!this.currentSessionId) return;

    const loadingMessage = 'Generating optimized test code with credentials...';
    console.log('🔐', loadingMessage);

    try {
      // Generate tests for each selected framework
      this.generatedTests = [];
      const frameworksToGenerate = this.selectedFrameworks.length > 0 
        ? this.selectedFrameworks 
        : ['cypress', 'playwright', 'selenium'];

      for (const framework of frameworksToGenerate) {
        const response = await fetch(`/api/headless-recording/generate-test-code/${this.currentSessionId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            framework,
            testName: this.currentRecording?.name || 'Generated Test',
            baseUrl: this.currentRecording?.url || 'http://localhost:4200'
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to generate ${framework} test: ${response.statusText}`);
        }

        const result = await response.json();
        if (result.success) {
          // Map the result to our GeneratedTest format
          const frameworkData = this.getFrameworkData(framework);
          const generatedTest = {
            framework: frameworkData,
            code: result.testCode,
            filename: `${this.sanitizeFilename(this.currentRecording?.name || 'test')}${frameworkData.extension}`,
            sessionId: this.currentSessionId,
            sessionMetadata: {
              sessionName: this.currentRecording?.name || 'Generated Test',
              recordedActions: result.originalActionCount,
              baseUrl: this.currentRecording?.url || 'http://localhost:4200'
            }
          };

          this.generatedTests.push(generatedTest);

          console.log(`✅ Generated ${framework} test with ${result.reductionPercentage}% optimization`);
          if (result.hasCredentials) {
            console.log(`🔐 Included ${result.credentialsUsed} credentials in test`);
          }
        }
      }

      this.showTestGeneration = true;
      this.saveGeneratedTestsToStorage();

      console.log(`✅ Generated ${this.generatedTests.length} optimized tests with credential support`);

    } catch (error) {
      console.error('❌ Failed to generate tests with credentials:', error);
      // Fallback to client-side generation
      console.log('🔄 Falling back to client-side generation...');
      this.generateTestsClientSide();
    }
  }

  /**
   * Generate tests using the client-side service (fallback)
   */
  private generateTestsClientSide(options: { useEnvironmentVariables?: boolean } = {}): void {
    console.log('🔧 chatbotInteractions data:', this.chatbotInteractions);
    
    // Prepare chatbot validation data for test generation
    const chatbotValidations = this.chatbotInteractions.map(interaction => ({
      userQuery: interaction.userQuery,
      botResponse: interaction.botResponse,
      isRelevant: interaction.validation?.isRelated || false,
      confidence: interaction.validation?.confidence || 0,
      reason: interaction.validation?.reason || ''
    }));
    
    console.log('🔧 Mapped chatbotValidations for test generation:', chatbotValidations.length);
    
    if (!this.currentRecording) {
      console.error('❌ No current recording available for test generation');
      return;
    }

    this.generatedTests = this.testGeneratorService.generateTests(
      this.currentRecording, 
      this.selectedFrameworks,
      {
        enableResponseValidation: true, // Always enabled
        enableSmartValidation: true, // Always enabled
        validationRules: [],
        chatbotValidations, // Pass chatbot validations to test generator
        useEnvironmentVariables: options.useEnvironmentVariables !== false // Default to true unless explicitly set to false
      }
    );
    this.showTestGeneration = true;
    
    // Save generated tests to localStorage for easy testing
    this.saveGeneratedTestsToStorage();
    
    console.log(`✅ Generated ${this.generatedTests.length} tests with ${chatbotValidations.length} chatbot validations`);
    console.log(`✅ showTestGeneration is now: ${this.showTestGeneration}`);
    console.log(`✅ This will trigger app-test-execution component with chatbotInteractions:`, this.chatbotInteractions.length);
  }

  /**
   * Get framework data by ID
   */
  private getFrameworkData(frameworkId: string) {
    const frameworkMap: any = {
      cypress: { id: 'cypress', name: 'Cypress', extension: '.cy.js', description: 'Modern E2E Testing' },
      playwright: { id: 'playwright', name: 'Playwright', extension: '.spec.js', description: 'Cross-browser Testing' },
      selenium: { id: 'selenium', name: 'Selenium', extension: '.test.js', description: 'WebDriver Testing' }
    };
    return frameworkMap[frameworkId] || frameworkMap.cypress;
  }

  /**
   * Sanitize filename for downloads
   */
  private sanitizeFilename(filename: string): string {
    return filename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  }

  toggleFrameworkSelection(frameworkId: string): void {
    const index = this.selectedFrameworks.indexOf(frameworkId);
    if (index > -1) {
      this.selectedFrameworks.splice(index, 1);
    } else {
      this.selectedFrameworks.push(frameworkId);
    }
  }

  isFrameworkSelected(frameworkId: string): boolean {
    return this.selectedFrameworks.includes(frameworkId);
  }

  downloadTest(test: GeneratedTest): void {
    this.testGeneratorService.downloadTest(test);
  }

  async downloadProject(test: GeneratedTest): Promise<void> {
    try {
      const targetUrl = this.getTargetUrl();
      await this.projectTemplateService.downloadProject(test, targetUrl);
      this.snackBar.open(`Downloaded ${test.framework.name} project successfully!`, 'Close', { 
        duration: 3000,
        panelClass: ['success-snackbar']
      });
    } catch (error) {
      console.error('Error downloading project:', error);
      this.snackBar.open('Failed to download project', 'Close', { 
        duration: 3000,
        panelClass: ['error-snackbar']
      });
    }
  }

  downloadAllGeneratedTests(): void {
    this.testGeneratorService.downloadAllTests(this.generatedTests);
  }

  async saveGeneratedTest(): Promise<void> {
    if (!this.currentRecording || this.generatedTests.length === 0) {
      this.snackBar.open('No generated tests to save', 'Close', { duration: 3000 });
      return;
    }

    // Debug authentication state
    const currentUser = this.authService.getCurrentUser();
    const isAuthenticated = this.authService.isLoggedIn();
    const token = localStorage.getItem('smart_analyzer_token') || sessionStorage.getItem('smart_analyzer_token');
    
    console.log('🔍 [SAVE_TEST] Debug authentication state:');
    console.log('  - Current user:', currentUser);
    console.log('  - Is authenticated:', isAuthenticated);
    console.log('  - Token exists:', !!token);
    console.log('  - Token preview:', token ? token.substring(0, 20) + '...' : 'None');
    
    if (!currentUser || !isAuthenticated) {
      this.snackBar.open('Please log in to save generated tests. Registration is free and takes just a minute!', 'Close', { 
        duration: 5000,
        panelClass: ['warning-snackbar']
      });
      return;
    }

    // Prompt user for a custom name
    const defaultName = `Generated Test - ${new Date().toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric', 
      hour: 'numeric', 
      minute: '2-digit'
    })}`;
    
    const customName = prompt('Enter a name for your test case:', defaultName);
    
    // User cancelled the prompt
    if (customName === null) {
      return;
    }
    
    // Use custom name or fallback to default with unique suffix
    if (customName && customName.trim()) {
      this.currentRecording.name = customName.trim();
    }

    this.isSavingTest = true;

    try {
      // Convert recorded actions to test steps format
      const testSteps = this.savedTestCasesService.convertTestStepsToSaveFormat(this.recordedActions || []);
      
      // Prepare generated tests data
      const generatedTests: { cypress?: string; playwright?: string; puppeteer?: string } = {};
      this.generatedTests.forEach(test => {
        if (test.framework.id === 'cypress') {
          generatedTests.cypress = test.code;
        } else if (test.framework.id === 'playwright') {
          generatedTests.playwright = test.code;
        } else if (test.framework.id === 'puppeteer') {
          generatedTests.puppeteer = test.code;
        }
      });
      
      // Generate a unique name if not provided with timestamp and random suffix
      const uniqueName = this.currentRecording.name || 
        `Generated Test - ${new Date().toLocaleString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric', 
          hour: 'numeric', 
          minute: '2-digit',
          second: '2-digit',
          hour12: true 
        })}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      // Prepare the test case data - simplified to focus on generated test code only
      const testCaseData = {
        name: uniqueName,
        description: `Generated test with ${this.generatedTests.length} framework(s): ${this.generatedTests.map(t => t.framework.name).join(', ')}. Complete test code included for: ${this.generatedTests.map(t => t.framework.id).join(', ')}`,
        url: this.currentRecording.url || '',
        sessionId: this.currentSessionId || `generated-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        category: 'functional' as const,
        tags: ['generated', 'automated', ...this.generatedTests.map(t => t.framework.id)],
        generatedTests: generatedTests,
        // Minimal required fields to avoid validation issues
        testSteps: [{ step: 1, action: 'navigate' as const, selector: '', value: '', description: 'Generated test - see generatedTests field for actual code' }],
        recordedActions: [],
        networkCalls: []
      };

      // Save using the existing SavedTestCasesService
      this.savedTestCasesService.saveTestCase(testCaseData).subscribe({
        next: (response) => {
          if (response.success) {
            this.snackBar.open(`Generated test saved successfully! You can find it in "Saved Test Cases"`, 'Close', { 
              duration: 5000,
              panelClass: ['success-snackbar']
            });
            
            // Optional: Clear the current session after successful save
            // this.clearAllStoredTests();
          } else {
            throw new Error(response.message || 'Failed to save test case');
          }
        },
        error: (error) => {
          console.error('❌ Error saving generated test:', error);
          
          // Handle authentication errors specifically
          if (error.status === 401 || error.error?.code === 'TOKEN_INVALID' || error.error?.code === 'TOKEN_EXPIRED') {
            this.snackBar.open('Your session has expired. Please log in again to save tests.', 'Close', { 
              duration: 5000,
              panelClass: ['warning-snackbar']
            });
          } else if (error.status === 409) {
            // Handle name conflict error - prompt user to try again with different name
            const errorMessage = error.error?.message || 'A test case with this name already exists. Please choose a different name.';
            this.snackBar.open(errorMessage, 'Retry', { 
              duration: 10000,
              panelClass: ['warning-snackbar']
            }).onAction().subscribe(() => {
              // Retry save operation when user clicks Retry
              this.saveGeneratedTest();
            });
          } else {
            this.snackBar.open(`Failed to save generated test: ${error.error?.message || error.message || 'Unknown error'}`, 'Close', { 
              duration: 5000,
              panelClass: ['error-snackbar']
            });
          }
        },
        complete: () => {
          this.isSavingTest = false;
        }
      });
      
    } catch (error) {
      console.error('❌ Error preparing test case data:', error);
      this.snackBar.open(`Failed to save generated test: ${error instanceof Error ? error.message : 'Unknown error'}`, 'Close', { 
        duration: 5000,
        panelClass: ['error-snackbar']
      });
      this.isSavingTest = false;
    }
  }

  // TEMPORARY DEBUG METHOD - Remove in production
  setupTestUser(): void {
    console.log('🧪 [TEST_RECORDING] Setting up test user for debugging save functionality');
    this.authService.refreshAuthenticationState();
    console.log('🧪 [TEST_RECORDING] Test user setup complete. You can now test the save functionality.');
    this.snackBar.open('Test user set up! You can now save tests.', 'Close', { 
      duration: 3000,
      panelClass: ['success-snackbar']
    });
  }

  // localStorage methods for generated tests
  private saveGeneratedTestsToStorage(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY_TESTS, JSON.stringify(this.generatedTests));
      localStorage.setItem(this.STORAGE_KEY_RECORDING, JSON.stringify(this.currentRecording));
      localStorage.setItem(this.STORAGE_KEY_CHATBOT, JSON.stringify(this.chatbotInteractions));
    } catch (error) {
      console.error('❌ Error saving tests to localStorage:', error);
    }
  }

  private loadGeneratedTestsFromStorage(): void {
    try {
      const testsJson = localStorage.getItem(this.STORAGE_KEY_TESTS);
      const recordingJson = localStorage.getItem(this.STORAGE_KEY_RECORDING);
      const chatbotJson = localStorage.getItem(this.STORAGE_KEY_CHATBOT);
      
      if (testsJson && recordingJson) {
        this.generatedTests = JSON.parse(testsJson);
        this.currentRecording = JSON.parse(recordingJson);
        this.chatbotInteractions = chatbotJson ? JSON.parse(chatbotJson) : [];
        this.showTestGeneration = true;
      }
    } catch (error) {
      console.error('❌ Error loading tests from localStorage:', error);
    }
  }

  clearAllStoredTests(): void {
    localStorage.removeItem(this.STORAGE_KEY_TESTS);
    localStorage.removeItem(this.STORAGE_KEY_RECORDING);
    localStorage.removeItem(this.STORAGE_KEY_CHATBOT);
    this.generatedTests = [];
    this.currentRecording = null;
    this.chatbotInteractions = [];
    this.showTestGeneration = false;
    console.log('🗑️ Cleared all stored tests from localStorage');
  }

  copyTestToClipboard(test: GeneratedTest): void {
    navigator.clipboard.writeText(test.code).then(() => {
      // You could add a snackbar notification here
      console.log('Test code copied to clipboard');
    });
  }

  // Test Execution Methods
  getTargetUrl(): string {
    // Try to get URL from current recording first
    if (this.currentRecording?.url) {
      return this.currentRecording.url;
    }
    if (this.currentRecording?.metadata?.targetUrl) {
      return this.currentRecording.metadata.targetUrl;
    }
    
    // Fallback: Try to get URL from generated tests' metadata
    if (this.generatedTests && this.generatedTests.length > 0) {
      const firstTestWithUrl = this.generatedTests.find(test => test.sessionMetadata?.baseUrl);
      if (firstTestWithUrl?.sessionMetadata?.baseUrl) {
        return firstTestWithUrl.sessionMetadata.baseUrl;
      }
    }
    
    return '';
  }

  onExecutionStarted(): void {
    console.log('Test execution started');
    console.log('📊 Chatbot validations being passed to execution:', this.chatbotInteractions.length);
    console.log('📊 Full chatbot validations data:', JSON.stringify(this.chatbotInteractions, null, 2));
    // Could add loading state or notifications here
  }

  onExecutionCompleted(results: any): void {
    console.log('Test execution completed:', results);
    // Could add success notifications or result processing here
  }

  onClearChatbotValidations(): void {
    console.log('Clearing chatbot validations from parent component');
    this.chatbotInteractions = [];
    // Also update localStorage to be consistent
    localStorage.removeItem(this.STORAGE_KEY_CHATBOT);
  }

  // Handle Enter key press in URL input
  onEnterKeyPressed(): void {
    console.log('🎹 Enter key pressed - attempting to start recording');
    
    // Validate URL first if provided
    if (this.externalUrl.trim() && !this.isValidUrl(this.externalUrl.trim())) {
      return;
    }
    
    // Only start recording if not already recording and not loading
    if (this.isRecording || this.isExternalRecording) {
      console.log('⚠️ Recording already in progress, ignoring Enter key');
      return;
    }
    
    if (this.isLoading) {
      console.log('⚠️ Currently loading, ignoring Enter key');
      return;
    }
    
    console.log('🚀 Starting recording via Enter key for URL:', this.externalUrl || 'localhost:4200/test-target');
    this.testExternalRecording();
  }

  // Handle URL input changes for real-time validation
  onUrlInput(): void {
    // Trim whitespace and validate
    const trimmedUrl = this.externalUrl.trim();
    if (trimmedUrl && !this.isValidUrl(trimmedUrl)) {
      // URL validation check without console output
    }
  }

  // Handle paste events to validate pasted URLs
  onUrlPaste(event: ClipboardEvent): void {
    // Get pasted text
    const pastedText = event.clipboardData?.getData('text') || '';
    
    // Allow the paste to happen first, then validate after a short delay
    setTimeout(() => {
      const fullUrl = this.externalUrl.trim();
      if (fullUrl && !this.isValidUrl(fullUrl)) {
        console.log('⚠️ Pasted content contains invalid URL:', fullUrl);
      } else if (fullUrl) {
        console.log('✅ Valid URL pasted:', fullUrl);
      }
    }, 10);
  }

  // Validate URL format
  private isValidUrl(url: string): boolean {
    try {
      // Enhanced regex pattern for URL validation with proper domain and TLD, or localhost
      const urlPattern = /^https?:\/\/(([a-zA-Z0-9\u002D]+\.)+[a-zA-Z]{2,}|localhost(:[0-9]+)?)(\/.*)?$/;
      if (!urlPattern.test(url)) {
        return false;
      }

      // Additional validation using URL constructor
      const urlObj = new URL(url);
      
      // Check protocol
      if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
        return false;
      }
      
      // Allow localhost
      if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
        return true;
      }
      
      // Check hostname has at least one dot (domain.tld)
      if (!urlObj.hostname.includes('.')) {
        return false;
      }
      
      // Check TLD is at least 2 characters
      const tld = urlObj.hostname.split('.').pop();
      if (!tld || tld.length < 2) {
        return false;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  // ============================================
  // CREDENTIAL MANAGEMENT METHODS
  // ============================================

  /**
   * Add a new credential field
   */
  addCredentialField(): void {
    if (this.credentialFields.length < 10) {
      this.credentialFields.push({
        name: '',
        value: '',
        type: 'text'
      });
    }
  }

  /**
   * Remove a credential field
   */
  removeCredentialField(index: number): void {
    if (this.credentialFields.length > 1) {
      this.credentialFields.splice(index, 1);
    }
  }

  /**
   * Toggle password visibility
   */
  togglePasswordVisibility(index: number): void {
    if (this.credentialFields[index]) {
      this.credentialFields[index].showValue = !this.credentialFields[index].showValue;
    }
  }

  /**
   * Get placeholder text for credential fields
   */
  getFieldPlaceholder(field: any): string {
    switch (field.type) {
      case 'username':
        return 'Enter username or email';
      case 'password':
        return 'Enter password (special characters supported)';
      case 'email':
        return 'user@example.com';
      case 'token':
        return 'API token or access token';
      case 'code':
        return '123456';
      default:
        return 'Enter value';
    }
  }

  /**
   * Get icon for credential field type
   */
  getFieldIcon(type: string): string {
    switch (type) {
      case 'username':
        return 'person';
      case 'password':
        return 'lock';
      case 'email':
        return 'email';
      case 'token':
        return 'key';
      case 'code':
        return 'pin';
      default:
        return 'text_fields';
    }
  }

  /**
   * Check if a value contains special characters
   */
  hasSpecialCharacters(value: string): boolean {
    if (!value) return false;
    const specialCharRegex = /[\\'"$`\n\r\t\u0000-\u001f\u007f-\u009f]/;
    return specialCharRegex.test(value);
  }

  /**
   * Validate email format
   */
  isValidEmail(email: string): boolean {
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Check if all credential fields are valid
   */
  hasValidCredentials(): boolean {
    return this.credentialFields.some(field => 
      field.name.trim() && field.value.trim()
    ) && this.credentialFields.every(field => {
      if (!field.name.trim() || !field.value.trim()) return true; // Empty fields are optional
      
      // Email validation
      if (field.type === 'email' && !this.isValidEmail(field.value)) {
        return false;
      }
      
      return true;
    });
  }

  /**
   * Store credentials securely
   */
  async storeCredentials(): Promise<void> {
    try {
      this.credentialsLoading = true;

      // Prepare credentials data
      const credentials: Record<string, string> = {};
      
      this.credentialFields.forEach(field => {
        if (field.name.trim() && field.value.trim()) {
          credentials[field.name.trim()] = field.value;
        }
      });

      if (Object.keys(credentials).length === 0) {
        throw new Error('No valid credentials to store');
      }

      // Generate session ID for this credential set
      const sessionId = (this.currentRecording as any)?.sessionId || `cred_${Date.now()}`;

      // Send to backend for secure storage
      const response = await fetch('/api/credentials/store', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId,
          credentials
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to store credentials: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        this.hasStoredCredentials = true;
        this.credentialCount = result.fieldsStored || Object.keys(credentials).length;
        this.sessionCredentials = { sessionId, timestamp: Date.now() };
        
        // Show success message
        console.log('✅ Credentials stored successfully');
        
        // Collapse the panel after successful storage
        this.credentialsExpanded = false;
      } else {
        throw new Error(result.error || 'Failed to store credentials');
      }

    } catch (error) {
      console.error('❌ Failed to store credentials:', error);
      // Show error to user (you might want to add a notification service)
      alert(`Failed to store credentials: ${error}`);
    } finally {
      this.credentialsLoading = false;
    }
  }

  /**
   * Clear all stored credentials
   */
  async clearCredentials(): Promise<void> {
    try {
      this.credentialsLoading = true;

      const sessionId = this.sessionCredentials?.sessionId;
      if (sessionId) {
        // Clear from backend
        await fetch('/api/credentials/clear', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ sessionId })
        });
      }

      // Clear local state
      this.hasStoredCredentials = false;
      this.credentialCount = 0;
      this.sessionCredentials = null;
      
      // Reset credential fields to default
      this.credentialFields = [
        { name: 'username', value: '', type: 'username' },
        { name: 'password', value: '', type: 'password', showValue: false }
      ];

      console.log('🗑️ Credentials cleared successfully');

    } catch (error) {
      console.error('❌ Failed to clear credentials:', error);
    } finally {
      this.credentialsLoading = false;
    }
  }

  /**
   * Load credentials from a file
   */
  async loadCredentialsFromFile(): Promise<void> {
    try {
      // Create file input element
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.json,.txt';
      
      fileInput.onchange = async (event: any) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
          const text = await file.text();
          let credentials: any;

          if (file.name.endsWith('.json')) {
            credentials = JSON.parse(text);
          } else {
            // Parse simple key=value format
            credentials = {};
            text.split('\n').forEach((line: string) => {
              const [key, ...valueParts] = line.split('=');
              if (key && valueParts.length > 0) {
                credentials[key.trim()] = valueParts.join('=').trim();
              }
            });
          }

          // Update credential fields
          this.credentialFields = [];
          Object.entries(credentials).forEach(([key, value]) => {
            this.credentialFields.push({
              name: key,
              value: value as string,
              type: this.detectFieldType(key)
            });
          });

          console.log('📁 Credentials loaded from file successfully');

        } catch (error) {
          console.error('❌ Failed to parse credentials file:', error);
          alert('Failed to parse credentials file. Please ensure it\'s valid JSON or key=value format.');
        }
      };

      fileInput.click();

    } catch (error) {
      console.error('❌ Failed to load credentials file:', error);
    }
  }

  /**
   * Auto-detect field type based on field name
   */
  private detectFieldType(fieldName: string): 'username' | 'password' | 'email' | 'token' | 'code' | 'text' {
    const name = fieldName.toLowerCase();
    
    if (name.includes('password') || name.includes('pass') || name.includes('pwd')) {
      return 'password';
    } else if (name.includes('username') || name.includes('user') || name.includes('login')) {
      return 'username';
    } else if (name.includes('email') || name.includes('mail')) {
      return 'email';
    } else if (name.includes('token') || name.includes('api') || name.includes('key')) {
      return 'token';
    } else if (name.includes('code') || name.includes('otp') || name.includes('2fa')) {
      return 'code';
    }
    
    return 'text';
  }

  /**
   * Validate network calls to match the expected schema
   */
  private validateNetworkCalls(networkCalls: any[]): any[] {
    if (!networkCalls || !Array.isArray(networkCalls)) {
      return [];
    }

    return networkCalls.filter(call => {
      // Check if the network call has the required structure for MongoDB schema
      return call && 
             typeof call === 'object' &&
             typeof call.id === 'string' &&
             typeof call.timestamp === 'number' &&
             typeof call.method === 'string' &&
             typeof call.url === 'string';
    });
  }

  /**
   * Show save test case dialog after test generation
   */


  /**
   * Convert recorded actions to test steps format
   */
  private convertActionsToTestSteps(actions: UserAction[]): TestStep[] {
    return actions.map((action, index) => ({
      step: index + 1,
      action: this.mapActionType(action.type),
      selector: action.element?.selector || '',
      value: action.data?.value || action.element?.text || '',
      description: this.generateStepDescription(action),
      waitTime: 0, // UserAction doesn't have waitTime, set to 0
      expectedResult: ''
    }));
  }

  /**
   * Map action types to test step actions
   */
  private mapActionType(actionType: string): TestStep['action'] {
    const actionMap: { [key: string]: TestStep['action'] } = {
      'click': 'click',
      'type': 'type',
      'input': 'type',
      'navigate': 'navigate',
      'scroll': 'scroll',
      'hover': 'hover',
      'select': 'select',
      'check': 'check',
      'uncheck': 'uncheck',
      'submit': 'submit',
      'keydown': 'keydown',
      'keyup': 'keyup',
      'drag': 'drag',
      'drop': 'drop',
      'screenshot': 'screenshot'
    };
    
    return actionMap[actionType.toLowerCase()] || 'click';
  }

  /**
   * Generate step description
   */
  private generateStepDescription(action: UserAction): string {
    const actionType = action.type.toLowerCase();
    const element = action.element?.selector || action.element?.tagName || 'element';
    const value = action.data?.value || action.element?.text || '';
    
    switch (actionType) {
      case 'click':
        return `Click ${element}`;
      case 'input':
        return `Type "${value}" in ${element}`;
      case 'navigation':
        return `Navigate to ${action.data?.url || 'page'}`;
      case 'scroll':
        return `Scroll to ${element}`;
      case 'hover':
        return `Hover over ${element}`;
      case 'form_submit':
        return `Submit ${element}`;
      case 'keypress':
        return `Press key "${action.data?.key}" on ${element}`;
      default:
        return `${actionType} ${element}`;
    }
  }

  /**
   * Generate suggested test name
   */
  private generateSuggestedTestName(): string {
    if (!this.currentRecording) return 'Test Case';
    
    try {
      const url = new URL(this.currentRecording.url);
      const domain = url.hostname.replace('www.', '');
      const path = url.pathname.split('/').filter(p => p).join(' ');
      
      let name = `Test ${domain}`;
      if (path) {
        name += ` - ${path}`;
      }
      
      // Add action-based context
      const hasLogin = this.recordedActions.some(action => 
        (action.element?.selector?.toLowerCase().includes('login') || 
         action.element?.selector?.toLowerCase().includes('password') ||
         action.data?.value?.toLowerCase().includes('login'))
      );
      
      if (hasLogin) {
        name += ' - Login Flow';
      }
      
      return name.replace(/\b\w/g, l => l.toUpperCase()).slice(0, 100);
    } catch {
      return `Test Case - ${new Date().toLocaleDateString()}`;
    }
  }

  /**
   * Generate suggested description
   */
  private generateSuggestedDescription(): string {
    if (!this.currentRecording || !this.recordedActions.length) return '';
    
    const actionTypes = [...new Set(this.recordedActions.map(a => a.type))];
    const uniqueElements = [...new Set(this.recordedActions.map(a => a.element?.selector).filter(s => s))];
    
    let description = `Automated test case with ${this.recordedActions.length} steps. `;
    description += `Actions include: ${actionTypes.join(', ')}. `;
    
    if (this.chatbotInteractions.length > 0) {
      description += `Includes ${this.chatbotInteractions.length} chatbot interaction(s). `;
    }
    
    description += `Generated on ${new Date().toLocaleDateString()}.`;
    
    return description;
  }

  /**
   * Calculate estimated duration
   */
  private calculateEstimatedDuration(testSteps: TestStep[]): string {
    // Base time per step + additional time for certain actions
    let totalSeconds = 0;
    
    testSteps.forEach(step => {
      switch (step.action) {
        case 'navigate':
          totalSeconds += 3; // Page load time
          break;
        case 'wait':
          totalSeconds += step.waitTime || 1;
          break;
        case 'type':
          totalSeconds += Math.max(1, (step.value?.length || 0) * 0.1);
          break;
        case 'screenshot':
          totalSeconds += 2;
          break;
        default:
          totalSeconds += 0.5; // Quick actions
      }
    });
    
    if (totalSeconds < 60) {
      return `~${Math.ceil(totalSeconds)} seconds`;
    } else {
      const minutes = Math.ceil(totalSeconds / 60);
      return `~${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
  }
}
