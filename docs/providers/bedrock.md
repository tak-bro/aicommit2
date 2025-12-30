# <a href="https://aws.amazon.com/bedrock/" target="_blank">Amazon Bedrock</a>

## 📌 Important Note

**Before configuring, please review:**

- [Configuration Guide](../../README.md#configuration) - How to configure providers
- [General Settings](../../README.md#general-settings) - Common settings applicable to all providers

## Quick Reference: Model ID Formats

| Format Type | Example | Use When | Availability |
|-------------|---------|----------|--------------|
| **Foundation Model** | `anthropic.claude-haiku-4-5-20251001-v1:0` | Single region, simple setup | Single AWS region |
| **US Inference Profile** | `us.anthropic.claude-haiku-4-5-20251001-v1:0` | US-based production | Multiple US regions |
| **EU Inference Profile** | `eu.anthropic.claude-haiku-4-5-20251001-v1:0` | EU data sovereignty | EU regions only |
| **Global Inference Profile** | `global.anthropic.claude-haiku-4-5-20251001-v1:0` | Best availability + cost savings | All commercial AWS regions |
| **Application Profile ARN** | `arn:aws:bedrock:...:application-inference-profile/...` | Custom app endpoints | Custom configuration |

💡 **Tip:** Start with foundation model format for development, switch to inference profiles for production.

See [Understanding Model ID Formats](#understanding-model-id-formats) below for detailed guidance.

## Authentication Methods

Bedrock supports two authentication approaches:

### AWS SDK Authentication (Recommended)

Uses IAM credentials with AWS SDK's ConverseCommand API.
Works with ALL model types: foundation models, cross-region inference profiles, application inference profiles.

**Configuration options:**
- AWS Profile: `BEDROCK.profile=your-profile`
- Access Keys: `BEDROCK.accessKeyId` + `BEDROCK.secretAccessKey`
- Environment variables: `AWS_PROFILE`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- IAM roles: Automatic on EC2/ECS/Lambda

**Example config:**
```sh
aicommit2 config set BEDROCK.model="anthropic.claude-haiku-4-5-20251001-v1:0" \
    BEDROCK.region="us-west-2" \
    BEDROCK.profile="my-aws-profile" \
    BEDROCK.codeReview=true
```

Or using environment variables:
```sh
export AWS_ACCESS_KEY_ID="AKIA..."
export AWS_SECRET_ACCESS_KEY="<secret>"
export AWS_SESSION_TOKEN="<optional-session-token>"
export AWS_REGION="us-west-2"
# or export AWS_DEFAULT_REGION
```

### Bearer Token Authentication

Uses API key with HTTP Bearer token for application endpoints.
For use cases where AWS SDK auth cannot be used.

**Configuration:**
- API Key: `BEDROCK.key` or `BEDROCK_API_KEY` environment variable
- Region or `applicationBaseUrl` required

**Example config:**
```sh
aicommit2 config set BEDROCK.model="anthropic.claude-haiku-4-5-20251001-v1:0" \
    BEDROCK.region="us-east-1" \
    BEDROCK.key="your-api-key" \
    BEDROCK.codeReview=true
```

Or set the API key via environment variable:
```sh
export BEDROCK_API_KEY="your-api-key"
```

For custom application endpoints:
```sh
aicommit2 config set BEDROCK.model="anthropic.claude-haiku-4-5-20251001-v1:0" \
    BEDROCK.applicationBaseUrl="https://bedrock-runtime.us-west-2.amazonaws.com/application-inference" \
    BEDROCK.applicationEndpointId="your-endpoint-id" \
    BEDROCK.key="your-api-key" \
    BEDROCK.codeReview=true
```

### Auto-Detection

Authentication method is automatically selected:
- If AWS credentials configured → Uses AWS SDK (preferred)
- If only API key configured → Uses Bearer token
- If both configured → Uses AWS SDK (better integration)

## Migration from runtimeMode

If your config has `runtimeMode`:
- Remove it (field is deprecated and ignored)
- Authentication method is now auto-detected from your credentials
- No other changes needed

## Settings

| Setting                                 | Description                                                                                           | Default                                        |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `model`                                 | Bedrock model identifier                                                                              | `anthropic.claude-haiku-4-5-20251001-v1:0`     |
| `key`                                   | API key for Bearer token authentication (falls back to environment variables)                         | –                                              |
| `envKey`                                | Environment variable name that holds the API key                                                      | `BEDROCK_API_KEY` (also checks application key) |
| `region`                                | AWS region                                                                                            | `AWS_REGION`/`AWS_DEFAULT_REGION` if available |
| `profile`                               | Named AWS profile to load from `~/.aws/credentials`                                                   | `AWS_PROFILE` if available                     |
| `accessKeyId` / `secretAccessKey`       | Explicit IAM credentials                                                                              | `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`  |
| `sessionToken`                          | Optional STS session token                                                                            | `AWS_SESSION_TOKEN`                            |
| `applicationBaseUrl`                    | Base URL for application inference endpoints                                                          | –                                              |
| `applicationEndpointId`                 | Optional Bedrock application endpoint ID appended to the base URL                                    | –                                              |
| `applicationInferenceProfileArn`        | Optional inference profile ARN sent in requests                                                       | –                                              |
| `codeReview`                            | Enable Bedrock for code review prompts                                                                | `false`                                        |
| `inferenceParameters`                   | JSON object with model-specific inference parameters                                                  | `{}` (use model defaults)                      |

## Inference Parameters

By default, Bedrock does NOT send any inference parameters - models use their own defaults.

To customize inference behavior, use `inferenceParameters` with JSON format:

**Config file:**
```ini
[BEDROCK]
model="anthropic.claude-haiku-4-5-20251001-v1:0"
region="us-east-1"
inferenceParameters={"temperature":0.8,"maxTokens":2048}
```

**CLI:**
```bash
aicommit2 config set 'BEDROCK.inferenceParameters={"temperature":0.8,"maxTokens":2048}'
```

**Supported parameters** (varies by model):
- `temperature` - Controls randomness (0.0-2.0)
- `topP` - Nucleus sampling (0.0-1.0)
- `maxTokens` - Maximum response length
- `topK` - Top-k sampling
- `stopSequences` - Array of stop strings

**Important:**
- Different models support different parameters
- Some models (Claude 4.5) don't support both `temperature` AND `topP` together
- Validation is YOUR responsibility - wrong parameters will fail at runtime
- See [AWS Bedrock documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/inference-parameters.html) for model-specific details

**Note:** The old standalone `temperature`, `topP`, and `maxTokens` config fields are not supported for BEDROCK. Only `inferenceParameters` is used. If you need to set these values, use the `inferenceParameters` JSON object as shown above.

## Environment Variables

Amazon Bedrock honours the standard AWS environment variables in addition to provider-specific keys:

- `BEDROCK_API_KEY` – default API key variable for Bearer token authentication.
- `BEDROCK_APPLICATION_API_KEY` – fallback API key when `BEDROCK_API_KEY` is not defined.
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN` – IAM credentials for AWS SDK authentication.
- `AWS_REGION`, `AWS_DEFAULT_REGION` – region selection.
- `AWS_PROFILE` – named profile when using shared credentials files.
- `BEDROCK_APPLICATION_BASE_URL`, `BEDROCK_APPLICATION_ENDPOINT_ID`, `BEDROCK_APPLICATION_INFERENCE_PROFILE_ARN` – optional helpers for application endpoints.

Use `BEDROCK.envKey` if you prefer to point to a custom environment variable for your API key.

## Understanding Model ID Formats

Amazon Bedrock supports two types of model identifiers:

### Foundation Model IDs (Region-Specific)

**Format:** `provider.model-name-version:0`

**Example:** `anthropic.claude-haiku-4-5-20251001-v1:0`

Use foundation model IDs when:
- You want requests sent to a single, specific AWS region
- You're working in a controlled environment with fixed regional requirements
- You need simple, straightforward configuration

**Configuration example:**
```sh
aicommit2 config set BEDROCK.model="anthropic.claude-haiku-4-5-20251001-v1:0" \
    BEDROCK.region="us-west-2" \
    BEDROCK.profile="my-aws-profile"
```

### Cross-Region Inference Profile IDs (Multi-Region)

**Format:** `[prefix].provider.model-name-version:0`

**Example:** `us.anthropic.claude-haiku-4-5-20251001-v1:0`

Cross-region inference profiles route requests across multiple AWS regions for improved:
- **Availability**: Automatic failover if a region is unavailable
- **Throughput**: Higher request limits across multiple regions
- **Latency**: Routing to the optimal region

**Available Prefixes:**
- `global.` - Worldwide routing (best availability, ~10% cost savings)
- `us.` - US regions only
- `eu.` - European regions only
- `apac.` - Asia-Pacific regions only
- `ca.` - Canada regions only
- `jp.` - Japan regions only
- `au.` - Australia regions only
- `us-gov.` - US Government regions only

**Configuration example:**
```sh
aicommit2 config set BEDROCK.model="us.anthropic.claude-haiku-4-5-20251001-v1:0" \
    BEDROCK.region="us-east-1" \
    BEDROCK.profile="my-aws-profile"
```

**Important:** Some newer models (e.g., Claude 3.7 Sonnet) only support inference profiles and require the prefixed format.

### Which Format Should You Use?

| Scenario | Recommended Format | Example |
|----------|-------------------|---------|
| Production workloads requiring high availability | Cross-region (global or regional) | `global.anthropic.claude-sonnet-4-5-20250929-v1:0` |
| Data sovereignty requirements (EU only) | Regional inference profile | `eu.anthropic.claude-haiku-4-5-20251001-v1:0` |
| Cost optimization for high-volume use | Global inference profile | `global.anthropic.claude-haiku-4-5-20251001-v1:0` |
| Simple single-region deployment | Foundation model ID | `anthropic.claude-haiku-4-5-20251001-v1:0` |
| Newer models that require inference profiles | Cross-region inference profile | `us.anthropic.claude-3-7-sonnet-20250219-v1:0` |

For most production use cases, AWS recommends using cross-region inference profiles for better availability and throughput.

**Learn more:**
- [Amazon Bedrock Inference profiles](https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles.html)
- [Cross-Region inference](https://docs.aws.amazon.com/bedrock/latest/userguide/cross-region-inference.html)
- [Supported Regions and models for inference profiles](https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-support.html)

## Example Model IDs

Amazon Bedrock supports various foundation models from different providers. Models are shown in both formats - use the one that matches your requirements (see [Understanding Model ID Formats](#understanding-model-id-formats) above).

### Anthropic Claude Models (Latest)

| Model | Foundation Model Format | Cross-Region Inference Profile Format |
|-------|------------------------|--------------------------------------|
| **Claude Sonnet 4.5** <br/> Most intelligent, best for coding and complex agents | `anthropic.claude-sonnet-4-5-20250929-v1:0` | `global.anthropic.claude-sonnet-4-5-20250929-v1:0`<br/>`us.anthropic.claude-sonnet-4-5-20250929-v1:0` |
| **Claude Haiku 4.5** <br/> Near-frontier performance at lower cost | `anthropic.claude-haiku-4-5-20251001-v1:0` | `global.anthropic.claude-haiku-4-5-20251001-v1:0`<br/>`us.anthropic.claude-haiku-4-5-20251001-v1:0` |
| **Claude Opus 4.1** <br/> Previous generation flagship | `anthropic.claude-opus-4-1-20250805-v1:0` | `global.anthropic.claude-opus-4-1-20250805-v1:0`<br/>`us.anthropic.claude-opus-4-1-20250805-v1:0` |
| **Claude 3.7 Sonnet** ⚠️ <br/> Requires inference profile | N/A - Not available | `us.anthropic.claude-3-7-sonnet-20250219-v1:0` |

⚠️ = This model only supports inference profiles (prefixed format required)

### Meta Llama Models (Latest)
- `meta.llama4-scout-17b-instruct-v1:0` - Llama 4 Scout 17B
- `meta.llama4-maverick-17b-instruct-v1:0` - Llama 4 Maverick 17B
- `meta.llama3-3-70b-instruct-v1:0` - Llama 3.3 70B
- `meta.llama3-2-90b-instruct-v1:0` - Llama 3.2 90B

### Amazon Nova Models (Latest)
- `amazon.nova-premier-v1:0` - Nova Premier (most capable)
- `amazon.nova-pro-v1:0` - Nova Pro (balanced performance)
- `amazon.nova-sonic-v1:0` - Nova Sonic (with speech input/output)
- `amazon.nova-reel-v1:1` - Nova Reel (video generation)

### Mistral AI Models
- `mistral.pixtral-large-2502-v1:0` - Pixtral Large (multimodal)
- `mistral.mistral-large-2407-v1:0` - Mistral Large 24.07

### Other Providers
- `deepseek.r1-v1:0` - DeepSeek-R1
- `qwen.qwen3-235b-a22b-2507-v1:0` - Qwen3 235B

**Note:** Other model providers (Meta Llama, Amazon Nova, Mistral, etc.) also support both foundation model and inference profile formats. Use the same pattern: add `global.`, `us.`, `eu.`, or other regional prefixes as needed.

**Learn more:**
- [AWS Bedrock Model IDs documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids.html)
- [Model availability by region](https://docs.aws.amazon.com/bedrock/latest/userguide/bedrock-regions.html)

## Tips

- **AWS SDK Authentication** (recommended) relies on IAM credentials or AWS profiles. The CLI automatically checks IAM-related environment variables and does not require an API key when they are present.
- **Bearer Token Authentication** requires an API key and either a region or custom application endpoint configuration.
- The CLI logs every request/response via `~/.local/state/aicommit2/logs` when `logging=true` to help diagnose AWS-specific errors.
- Combine multiple Bedrock models by comma separating `BEDROCK.model` values.

## Troubleshooting

### Authentication Issues

**Problem**: `UnrecognizedClientException` or `InvalidSignatureException`

**Solution**:
- Verify your AWS credentials are correct: `aws sts get-caller-identity`
- Ensure `AWS_REGION` or `AWS_DEFAULT_REGION` is set when using IAM credentials
- Check that your IAM credentials haven't expired (especially session tokens)
- For Bearer token auth, verify your `BEDROCK_API_KEY` is correct

**Problem**: `AccessDeniedException`

**Solution**:
- Ensure your IAM user/role has the `bedrock:InvokeModel` permission
- Add the following policy to your IAM user/role:
  ```json
  {
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": "bedrock:InvokeModel",
      "Resource": "arn:aws:bedrock:*::foundation-model/*"
    }]
  }
  ```
- For application endpoints, verify you have permissions for `bedrock:InvokeModelWithResponseStream` if needed

### Region and Model Issues

**Problem**: `ResourceNotFoundException` - Model not found

**Solutions**:

1. **Check model ID format** - Try both foundation model and inference profile formats:
   - Foundation model: `anthropic.claude-haiku-4-5-20251001-v1:0`
   - Cross-region inference profile: `us.anthropic.claude-haiku-4-5-20251001-v1:0`
   - Global inference profile: `global.anthropic.claude-haiku-4-5-20251001-v1:0`
   - See [Understanding Model ID Formats](#understanding-model-id-formats) for guidance

2. **Some models require inference profile format:**
   - Claude 3.7 Sonnet and other newer models only support prefixed format
   - If a foundation model ID fails, try adding a regional prefix (e.g., `us.` or `global.`)

3. **Enable model access in AWS Bedrock console:**
   - Go to AWS Bedrock Console → Model access
   - Request access for the specific model
   - Wait for approval (usually instant)
   - [Model access documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html)

4. **Verify regional availability:**
   - Not all models are available in all regions
   - Check [AWS Bedrock regions](https://docs.aws.amazon.com/bedrock/latest/userguide/bedrock-regions.html)
   - Consider using cross-region inference profiles for better availability

5. **Verify you have the correct permissions:**
   - Ensure your IAM user/role has `bedrock:InvokeModel` permission
   - For inference profiles, you may need additional permissions

**Tip**: If a foundation model ID doesn't work, try adding a regional prefix (e.g., change `anthropic.claude-haiku-4-5-20251001-v1:0` to `us.anthropic.claude-haiku-4-5-20251001-v1:0` or `global.anthropic.claude-haiku-4-5-20251001-v1:0`)

**Problem**: `ValidationException` - Invalid request

**Solution**:
- Check that your model ID matches the exact format required by AWS Bedrock
- Verify inference parameters (`temperature`, `topP`, `maxTokens`) are within valid ranges for your model
- Some models have specific requirements - consult the model documentation

**Problem**: `ValidationException` - "`temperature` and `top_p` cannot both be specified for this model"

**Solution**:
- Some Claude models (particularly via Application Inference Profiles) don't support both `temperature` and `topP` simultaneously
- By default, aicommit2 sends NO inference parameters - models use their own defaults
- If you explicitly set both parameters in `inferenceParameters`, you'll get this error
- Only include ONE of these parameters in your `inferenceParameters` configuration:
  ```bash
  # Use temperature only
  aicommit2 config set 'BEDROCK.inferenceParameters={"temperature":0.8}'

  # OR use topP only
  aicommit2 config set 'BEDROCK.inferenceParameters={"topP":0.9}'
  ```

### Configuration Issues

**Problem**: Bedrock provider not appearing in available AIs

**Solution**:
- Ensure you have configured at least one of:
  - AWS SDK auth: Set `AWS_REGION` + (`AWS_ACCESS_KEY_ID` & `AWS_SECRET_ACCESS_KEY` OR `AWS_PROFILE`)
  - Bearer token auth: Set `BEDROCK.region` + `BEDROCK.key` (or `BEDROCK_API_KEY`)
  - Custom application endpoint: Set `BEDROCK.applicationBaseUrl` or `BEDROCK.applicationEndpointId` + `BEDROCK.key`
- Verify you have a model configured: `aicommit2 config get BEDROCK.model`
- For code reviews, ensure `BEDROCK.codeReview=true`

**Problem**: "AWS region is required" error

**Solution**:
- Set the region explicitly: `aicommit2 config set BEDROCK.region="us-west-2"`
- Or set environment variable: `export AWS_REGION=us-west-2`

**Problem**: Invalid application base URL

**Solution**:
- Ensure the URL is properly formatted with protocol: `https://bedrock-runtime.us-west-2.amazonaws.com/application-inference`
- If using endpoint ID, it will be automatically appended to the base URL
- Test the URL format before adding to config

### Rate Limiting and Throttling

**Problem**: `ThrottlingException`

**Solution**:
- Wait a moment and retry the operation
- Check your AWS Bedrock service quotas in the AWS console
- Consider upgrading your AWS account or requesting quota increases
- Reduce the frequency of requests or implement retry logic with exponential backoff

### Debug Mode

To get detailed logs for troubleshooting:

1. Enable logging:
   ```sh
   aicommit2 config set BEDROCK.logging=true
   ```

2. Check logs at:
   - macOS: `~/Library/Application Support/aicommit2/logs/`
   - Linux: `~/.local/state/aicommit2/logs/`
   - Windows: `%LOCALAPPDATA%/aicommit2/logs/`

3. Look for request/response details, credential resolution, and error messages

### Testing Your Configuration

Verify your setup with these commands:

```sh
# Check your AWS identity (for AWS SDK auth)
aws sts get-caller-identity

# Verify AWS Bedrock access
aws bedrock list-foundation-models --region us-west-2

# Test your aicommit2 configuration
aicommit2 config get BEDROCK

# Make a test commit with verbose output
aicommit2 --verbose
```

## Common Configuration Examples

### Example 1: Simple single-region setup (development)
```sh
aicommit2 config set \
    BEDROCK.model="anthropic.claude-haiku-4-5-20251001-v1:0" \
    BEDROCK.region="us-east-1" \
    BEDROCK.profile="default"
```

Use this for development or when you need a simple single-region deployment.

### Example 2: High-availability production setup (US regions)
```sh
aicommit2 config set \
    BEDROCK.model="us.anthropic.claude-sonnet-4-5-20250929-v1:0" \
    BEDROCK.region="us-east-1" \
    BEDROCK.profile="prod" \
    BEDROCK.codeReview=true
```

Use US inference profile for production workloads requiring high availability across US regions.

### Example 3: Global deployment with cost optimization
```sh
aicommit2 config set \
    BEDROCK.model="global.anthropic.claude-haiku-4-5-20251001-v1:0" \
    BEDROCK.region="us-west-2" \
    BEDROCK.profile="prod"
```

Use global inference profile for best availability and ~10% cost savings through cross-region routing.

### Example 4: EU data sovereignty compliance
```sh
aicommit2 config set \
    BEDROCK.model="eu.anthropic.claude-sonnet-4-5-20250929-v1:0" \
    BEDROCK.region="eu-west-1" \
    BEDROCK.profile="eu-prod"
```

Use EU inference profile to ensure all requests stay within European regions for data compliance.

### Example 5: Multiple models with mixed formats
```sh
aicommit2 config set \
    BEDROCK.model="anthropic.claude-haiku-4-5-20251001-v1:0,us.anthropic.claude-sonnet-4-5-20250929-v1:0" \
    BEDROCK.region="us-east-1" \
    BEDROCK.profile="default"
```

Combine foundation model and inference profile formats for flexibility.

### Example 6: Using newer models requiring inference profiles
```sh
# Claude 3.7 Sonnet requires inference profile format
aicommit2 config set \
    BEDROCK.model="us.anthropic.claude-3-7-sonnet-20250219-v1:0" \
    BEDROCK.region="us-east-1" \
    BEDROCK.profile="default"
```

Some newer models only work with the prefixed inference profile format.
