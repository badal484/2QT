#include <string>
#include <vector>
#include <memory>

namespace facebook {
namespace react {

struct DebugStringConvertibleOptions {
  bool format{true};
};

class DebugStringConvertible {
public:
    virtual ~DebugStringConvertible();
    virtual std::string getDebugName() const;
    virtual std::string getDebugValue() const;
    virtual std::vector<std::shared_ptr<DebugStringConvertible>> getDebugChildren() const;
    virtual std::string getDebugDescription(DebugStringConvertibleOptions) const;
    virtual std::string getDebugPropsDescription(DebugStringConvertibleOptions) const;
    virtual std::string getDebugChildrenDescription(DebugStringConvertibleOptions) const;
};

DebugStringConvertible::~DebugStringConvertible() {}
std::string DebugStringConvertible::getDebugName() const { return ""; }
std::string DebugStringConvertible::getDebugValue() const { return ""; }
std::vector<std::shared_ptr<DebugStringConvertible>> DebugStringConvertible::getDebugChildren() const { return {}; }
std::string DebugStringConvertible::getDebugDescription(DebugStringConvertibleOptions) const { return ""; }
std::string DebugStringConvertible::getDebugPropsDescription(DebugStringConvertibleOptions) const { return ""; }
std::string DebugStringConvertible::getDebugChildrenDescription(DebugStringConvertibleOptions) const { return ""; }

class Sealable {
public:
    Sealable();
    virtual ~Sealable();
    void ensureUnsealed() const;
};

Sealable::Sealable() {}
Sealable::~Sealable() {}
void Sealable::ensureUnsealed() const {}

class BaseViewProps {
public:
    virtual ~BaseViewProps();
    virtual std::string getDebugProps() const;
};
BaseViewProps::~BaseViewProps() {}
std::string BaseViewProps::getDebugProps() const { return ""; }

class YogaStylableProps {
public:
    virtual ~YogaStylableProps();
    virtual std::string getDebugProps() const;
};
YogaStylableProps::~YogaStylableProps() {}
std::string YogaStylableProps::getDebugProps() const { return ""; }

class LayoutableShadowNode {
public:
    virtual ~LayoutableShadowNode();
    virtual std::string getDebugProps() const;
};
LayoutableShadowNode::~LayoutableShadowNode() {}
std::string LayoutableShadowNode::getDebugProps() const { return ""; }

class Props {
public:
    virtual ~Props();
    virtual std::string getDebugProps() const;
};
Props::~Props() {}
std::string Props::getDebugProps() const { return ""; }

class ShadowNode {
public:
    std::string getDebugName() const;
    std::string getDebugValue() const;
    std::vector<std::shared_ptr<DebugStringConvertible>> getDebugChildren() const;
};

std::string ShadowNode::getDebugName() const { return ""; }
std::string ShadowNode::getDebugValue() const { return ""; }
std::vector<std::shared_ptr<DebugStringConvertible>> ShadowNode::getDebugChildren() const { return {}; }

}
}
