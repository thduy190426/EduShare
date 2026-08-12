const validate = (schema) => {
    return (req, res, next) => {
        try {
            schema.parse(req.body);
            next();
        } catch (error) {
            if (error.name === 'ZodError') {
                const formattedErrors = error.errors.map(err => ({
                    path: err.path.join('.'),
                    message: err.message
                }));
                return res.status(400).json({
                    message: 'Dữ liệu đầu vào không hợp lệ',
                    errors: formattedErrors
                });
            }
            next(error);
        }
    };
};

module.exports = { validate };
