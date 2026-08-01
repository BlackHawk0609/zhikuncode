package com.aicodeassistant.exception;

/**
 * Stable validation failure returned through the REST error envelope.
 */
public class RequestValidationException extends RuntimeException {

    private final String code;

    public RequestValidationException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
