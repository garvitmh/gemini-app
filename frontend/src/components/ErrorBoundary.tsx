import { Component, ErrorInfo, ReactNode } from 'react';
import { Banner, Button, Page, BlockStack } from '@shopify/polaris';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): State {
        return {
            hasError: true,
            error,
            errorInfo: null,
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.setState({
            error,
            errorInfo,
        });
    }

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };

    render() {
        if (this.state.hasError) {
            return (
                <Page title="Something went wrong">
                    <BlockStack gap="400">
                        <Banner
                            title="Application Error"
                            tone="critical"
                        >
                            <p>
                                An unexpected error occurred. Please try refreshing the page or contact support if the problem persists.
                            </p>
                            {this.state.error && (
                                <p style={{ marginTop: '10px', fontSize: '12px', fontFamily: 'monospace' }}>
                                    {this.state.error.toString()}
                                </p>
                            )}
                        </Banner>

                        <Button onClick={this.handleReset}>
                            Reset Application
                        </Button>
                    </BlockStack>
                </Page>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
