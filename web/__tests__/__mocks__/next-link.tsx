import React from 'react';
const Link = ({ children, href, ...rest }: any) => <a href={href} {...rest}>{children}</a>;
export default Link;
