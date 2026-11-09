/** How an error names the request the provider answered, when it said which one: a support ticket starts there. */
export function requested(requestId: string | null): string {
    return requestId === null ? '' : ` (request ${requestId})`
}
