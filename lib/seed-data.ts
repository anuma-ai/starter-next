/**
 * Seed data types and generators for testing
 */

export type SeedFile = {
  id: string;
  name: string;
  type: string;
  size: number;
  url?: string;
};

export type SeedMessage = {
  role: "user" | "assistant";
  content: string;
  model?: string;
  files?: SeedFile[];
  thinking?: string;
};

export type SeedConversation = {
  conversationId: string;
  title: string;
  projectId?: string;
  messages: SeedMessage[];
};

export type SeedProject = {
  projectId: string;
  name: string;
};

export type SeedData = {
  projects: SeedProject[];
  conversations: SeedConversation[];
};

// Sample cat image as a small placeholder (1x1 gray pixel)
const PLACEHOLDER_IMAGE_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

// A simple generated image placeholder (blue gradient)
const GENERATED_IMAGE_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVR42mNk+P+/HgMRgHFUIX0VAgAqpg7wdMkckwAAAABJRU5ErkJggg==";

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Generate default seed data with varied conversations and projects
 */
export function generateDefaultSeedData(): SeedData {
  const projects: SeedProject[] = [
    { projectId: "proj-work", name: "Work Projects" },
    { projectId: "proj-personal", name: "Personal" },
    { projectId: "proj-research", name: "Research" },
    { projectId: "proj-testing", name: "Testing" },
  ];

  const conversations: SeedConversation[] = [
    // Short conversation - Quick Q&A
    {
      conversationId: generateId(),
      title: "What is TypeScript?",
      projectId: "proj-work",
      messages: [
        { role: "user", content: "What is TypeScript?" },
        {
          role: "assistant",
          content:
            "TypeScript is a strongly typed programming language that builds on JavaScript. It adds optional static typing and class-based object-oriented programming to the language. TypeScript code compiles to plain JavaScript, so it can run anywhere JavaScript runs.",
          model: "claude-3-5-sonnet",
        },
      ],
    },

    // Medium conversation - Code help
    {
      conversationId: generateId(),
      title: "React useState hook",
      projectId: "proj-work",
      messages: [
        { role: "user", content: "How do I use useState in React?" },
        {
          role: "assistant",
          content:
            "The useState hook lets you add state to functional components. Here's a basic example:\n\n```tsx\nimport { useState } from 'react';\n\nfunction Counter() {\n  const [count, setCount] = useState(0);\n  \n  return (\n    <button onClick={() => setCount(count + 1)}>\n      Count: {count}\n    </button>\n  );\n}\n```",
          model: "claude-3-5-sonnet",
        },
        { role: "user", content: "What about using it with objects?" },
        {
          role: "assistant",
          content:
            "When using useState with objects, remember that you need to spread the previous state when updating:\n\n```tsx\nconst [user, setUser] = useState({ name: '', email: '' });\n\n// Update just the name\nsetUser(prev => ({ ...prev, name: 'John' }));\n```\n\nThis ensures you don't lose other properties when updating a single field.",
          model: "claude-3-5-sonnet",
        },
        { role: "user", content: "Can I use multiple useState calls?" },
        {
          role: "assistant",
          content:
            "Yes! You can use multiple useState calls in a single component. This is often cleaner than having one large state object:\n\n```tsx\nfunction Form() {\n  const [name, setName] = useState('');\n  const [email, setEmail] = useState('');\n  const [isSubmitting, setIsSubmitting] = useState(false);\n  \n  // Each state variable can be updated independently\n}\n```\n\nThis approach makes it clear what state your component manages and allows React to optimize re-renders better.",
          model: "claude-3-5-sonnet",
        },
      ],
    },

    // Conversation with image attachment
    {
      conversationId: generateId(),
      title: "Analyze this image",
      projectId: "proj-personal",
      messages: [
        {
          role: "user",
          content: "Can you describe what's in this image?",
          files: [
            {
              id: generateId(),
              name: "photo.jpg",
              type: "image/jpeg",
              size: 245000,
              url: PLACEHOLDER_IMAGE_URL,
            },
          ],
        },
        {
          role: "assistant",
          content:
            "I can see a simple gray placeholder image. It appears to be a 1x1 pixel image used as a placeholder. In a real scenario, I would analyze the actual image content and describe what I see - including objects, people, colors, composition, and any text visible in the image.",
          model: "claude-3-5-sonnet",
        },
      ],
    },

    // Conversation with generated image
    {
      conversationId: generateId(),
      title: "Generate a landscape",
      projectId: "proj-personal",
      messages: [
        { role: "user", content: "Generate an image of a mountain landscape at sunset" },
        {
          role: "assistant",
          content:
            "I've generated a mountain landscape image for you. The scene depicts majestic peaks silhouetted against a vibrant sunset sky with warm orange and purple hues reflecting off a calm lake in the foreground.",
          model: "claude-3-5-sonnet",
          files: [
            {
              id: generateId(),
              name: "generated-landscape.png",
              type: "image/png",
              size: 512000,
              url: GENERATED_IMAGE_URL,
            },
          ],
        },
      ],
    },

    // Research conversation with thinking
    {
      conversationId: generateId(),
      title: "Quantum computing basics",
      projectId: "proj-research",
      messages: [
        { role: "user", content: "Explain quantum computing in simple terms" },
        {
          role: "assistant",
          content:
            "Quantum computing uses quantum mechanics to process information in fundamentally different ways than classical computers.\n\n**Key concepts:**\n\n1. **Qubits** - Unlike classical bits (0 or 1), qubits can be in a superposition of both states simultaneously.\n\n2. **Superposition** - A qubit can represent multiple values at once, allowing quantum computers to explore many solutions in parallel.\n\n3. **Entanglement** - Qubits can be linked so that the state of one instantly affects another, regardless of distance.\n\n4. **Quantum advantage** - For certain problems (like factoring large numbers or simulating molecules), quantum computers can be exponentially faster than classical ones.",
          model: "claude-3-5-sonnet",
          thinking:
            "The user wants a simple explanation, so I should avoid heavy mathematical formalism. I'll focus on the key concepts that differentiate quantum computing from classical computing, using analogies where helpful.",
        },
      ],
    },

    // Long conversation - debugging session
    {
      conversationId: generateId(),
      title: "Debug React performance issue",
      projectId: "proj-work",
      messages: [
        { role: "user", content: "My React app is really slow when rendering a list of 1000 items" },
        {
          role: "assistant",
          content:
            "There are several strategies to improve performance when rendering large lists in React:\n\n1. **Virtualization** - Only render items visible in the viewport using libraries like `react-window` or `react-virtualized`\n\n2. **Memoization** - Use `React.memo()` to prevent unnecessary re-renders of list items\n\n3. **Key optimization** - Ensure you're using stable, unique keys (not array indices)\n\nCan you share your current list component code?",
          model: "claude-3-5-sonnet",
        },
        {
          role: "user",
          content:
            "Here's my code:\n```tsx\nfunction ItemList({ items }) {\n  return (\n    <div>\n      {items.map((item, index) => (\n        <Item key={index} data={item} />\n      ))}\n    </div>\n  );\n}\n```",
        },
        {
          role: "assistant",
          content:
            "I can see a few issues:\n\n1. **Using index as key** - This causes React to re-render all items when the list changes. Use a unique identifier from your data instead.\n\n2. **No virtualization** - You're rendering all 1000 items at once.\n\n3. **No memoization** - The Item component likely re-renders unnecessarily.\n\nHere's an improved version using react-window:\n\n```tsx\nimport { FixedSizeList } from 'react-window';\nimport { memo } from 'react';\n\nconst Item = memo(({ data, style }) => (\n  <div style={style}>{data.name}</div>\n));\n\nfunction ItemList({ items }) {\n  return (\n    <FixedSizeList\n      height={400}\n      itemCount={items.length}\n      itemSize={50}\n      width=\"100%\"\n    >\n      {({ index, style }) => (\n        <Item key={items[index].id} data={items[index]} style={style} />\n      )}\n    </FixedSizeList>\n  );\n}\n```",
          model: "claude-3-5-sonnet",
        },
        { role: "user", content: "How do I install react-window?" },
        {
          role: "assistant",
          content: "Install it with npm or yarn:\n\n```bash\nnpm install react-window\n# or\nyarn add react-window\n```\n\nFor TypeScript, also install the types:\n\n```bash\nnpm install -D @types/react-window\n```",
          model: "claude-3-5-sonnet",
        },
        { role: "user", content: "What if my items have different heights?" },
        {
          role: "assistant",
          content:
            "For variable height items, use `VariableSizeList` instead:\n\n```tsx\nimport { VariableSizeList } from 'react-window';\n\nfunction ItemList({ items }) {\n  const getItemSize = (index) => {\n    // Return the height for each item\n    return items[index].height || 50;\n  };\n\n  return (\n    <VariableSizeList\n      height={400}\n      itemCount={items.length}\n      itemSize={getItemSize}\n      width=\"100%\"\n    >\n      {({ index, style }) => (\n        <Item key={items[index].id} data={items[index]} style={style} />\n      )}\n    </VariableSizeList>\n  );\n}\n```\n\nIf you don't know heights ahead of time, consider using `react-virtualized-auto-sizer` with `react-window` or the `react-virtuoso` library which handles dynamic heights automatically.",
          model: "claude-3-5-sonnet",
        },
        { role: "user", content: "Thanks! The performance is much better now." },
        {
          role: "assistant",
          content:
            "Great to hear! A few more tips to keep in mind:\n\n- Use React DevTools Profiler to identify remaining bottlenecks\n- Consider lazy loading data with infinite scroll\n- If items have complex content, use `useMemo` for expensive computations\n\nFeel free to ask if you run into any other performance issues!",
          model: "claude-3-5-sonnet",
        },
      ],
    },

    // Conversation with file attachments
    {
      conversationId: generateId(),
      title: "Review my spreadsheet",
      projectId: "proj-work",
      messages: [
        {
          role: "user",
          content: "Can you help me analyze this data?",
          files: [
            {
              id: generateId(),
              name: "sales-data.xlsx",
              type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              size: 45000,
            },
            {
              id: generateId(),
              name: "report.pdf",
              type: "application/pdf",
              size: 125000,
            },
          ],
        },
        {
          role: "assistant",
          content:
            "I can see you've uploaded a spreadsheet (sales-data.xlsx) and a PDF report. Let me analyze them:\n\n**Sales Data Summary:**\n- The spreadsheet contains quarterly sales figures\n- Total revenue appears to show an upward trend\n- Q3 had the highest performance\n\n**Report Highlights:**\n- The PDF contains detailed analysis and charts\n- Key recommendations are outlined in section 3\n\nWould you like me to focus on any specific aspect of the data?",
          model: "claude-3-5-sonnet",
        },
      ],
    },

    // Empty conversation (edge case)
    {
      conversationId: generateId(),
      title: "New conversation",
      projectId: "proj-testing",
      messages: [],
    },

    // Conversation without project
    {
      conversationId: generateId(),
      title: "Quick question",
      messages: [
        { role: "user", content: "What time is it?" },
        {
          role: "assistant",
          content:
            "I don't have access to real-time information, so I can't tell you the current time. You can check your device's clock or ask a voice assistant for the current time.",
          model: "claude-3-5-sonnet",
        },
      ],
    },
  ];

  return { projects, conversations };
}

/**
 * Generate edge case seed data for testing unusual scenarios
 */
export function generateEdgeCaseSeedData(): SeedData {
  const projects: SeedProject[] = [{ projectId: "proj-edge", name: "Edge Cases" }];

  const veryLongMessage = "This is a very long message. ".repeat(500);
  const unicodeContent = "Unicode test: 你好世界 🌍 مرحبا العالم Привет мир 日本語 한국어 Ελληνικά עברית";
  const codeBlockContent = `Here's some complex code:

\`\`\`typescript
interface ComplexType<T extends Record<string, unknown>> {
  data: T;
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    version: number;
  };
  process: (input: T) => Promise<T>;
}

const handler: ComplexType<{ name: string }> = {
  data: { name: "test" },
  metadata: {
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
  },
  process: async (input) => {
    await new Promise(r => setTimeout(r, 100));
    return { ...input, name: input.name.toUpperCase() };
  }
};
\`\`\``;

  const conversations: SeedConversation[] = [
    // Very long message
    {
      conversationId: generateId(),
      title: "Very long message test",
      projectId: "proj-edge",
      messages: [
        { role: "user", content: veryLongMessage },
        {
          role: "assistant",
          content: "I received your very long message. It contains repeated text about 500 times.",
          model: "claude-3-5-sonnet",
        },
      ],
    },

    // Unicode and emoji
    {
      conversationId: generateId(),
      title: "Unicode and emoji test",
      projectId: "proj-edge",
      messages: [
        { role: "user", content: unicodeContent },
        {
          role: "assistant",
          content: `I can see various scripts and emoji: ${unicodeContent}\n\nAll characters should display correctly!`,
          model: "claude-3-5-sonnet",
        },
      ],
    },

    // Code blocks
    {
      conversationId: generateId(),
      title: "Code syntax highlighting",
      projectId: "proj-edge",
      messages: [
        { role: "user", content: "Show me complex TypeScript code" },
        {
          role: "assistant",
          content: codeBlockContent,
          model: "claude-3-5-sonnet",
        },
      ],
    },

    // Many file attachments
    {
      conversationId: generateId(),
      title: "Multiple file attachments",
      projectId: "proj-edge",
      messages: [
        {
          role: "user",
          content: "Here are many files",
          files: Array.from({ length: 10 }, (_, i) => ({
            id: generateId(),
            name: `file-${i + 1}.txt`,
            type: "text/plain",
            size: 1000 * (i + 1),
          })),
        },
        {
          role: "assistant",
          content: "I received 10 text files with varying sizes from 1KB to 10KB.",
          model: "claude-3-5-sonnet",
        },
      ],
    },

    // Special characters in title
    {
      conversationId: generateId(),
      title: "Title with <special> & \"characters\" 'quotes'",
      projectId: "proj-edge",
      messages: [
        { role: "user", content: "Testing special characters in conversation title" },
        { role: "assistant", content: "Title rendered successfully!", model: "claude-3-5-sonnet" },
      ],
    },

    // Very long conversation
    {
      conversationId: generateId(),
      title: "Long conversation (30+ messages)",
      projectId: "proj-edge",
      messages: Array.from({ length: 32 }, (_, i) => ({
        role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
        content: `Message ${i + 1}: ${i % 2 === 0 ? "User question about topic " + Math.ceil((i + 1) / 2) : "Assistant response to question " + Math.ceil((i + 1) / 2)}`,
        model: i % 2 === 1 ? "claude-3-5-sonnet" : undefined,
      })),
    },
  ];

  return { projects, conversations };
}

/**
 * Generate large seed data for performance testing
 */
export function generateLargeSeedData(conversationCount: number = 100): SeedData {
  const projects: SeedProject[] = [
    { projectId: "proj-perf-1", name: "Performance Test 1" },
    { projectId: "proj-perf-2", name: "Performance Test 2" },
    { projectId: "proj-perf-3", name: "Performance Test 3" },
  ];

  const conversations: SeedConversation[] = Array.from({ length: conversationCount }, (_, i) => {
    const projectIndex = i % 3;
    const messageCount = 2 + Math.floor(Math.random() * 8); // 2-10 messages

    return {
      conversationId: generateId(),
      title: `Test Conversation ${i + 1}`,
      projectId: projects[projectIndex].projectId,
      messages: Array.from({ length: messageCount }, (_, j) => ({
        role: (j % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
        content: `This is message ${j + 1} in conversation ${i + 1}. Lorem ipsum dolor sit amet, consectetur adipiscing elit.`,
        model: j % 2 === 1 ? "claude-3-5-sonnet" : undefined,
      })),
    };
  });

  return { projects, conversations };
}
