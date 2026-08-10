import React from 'react';

// Renders the dynamic component asynchronously (via useEffect), mirroring
// how next/dynamic works in a browser — use waitFor in tests.
const dynamic = (loader: () => Promise<any>, _opts?: any) => {
  return function DynamicComponent(props: any) {
    const [Comp, setComp] = React.useState<React.ComponentType<any> | null>(null);

    React.useEffect(() => {
      loader().then((mod: any) => {
        const Resolved = mod?.default ?? mod;
        setComp(() => Resolved);
      });
    }, []);

    if (!Comp) return null;
    return <Comp {...props} />;
  };
};

export default dynamic;
