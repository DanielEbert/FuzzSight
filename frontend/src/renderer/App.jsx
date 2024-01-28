import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import React, { useState, useMemo, useRef } from 'react';
import { IoMdArrowDropright } from "react-icons/io";
import { AiOutlineLoading } from "react-icons/ai";
import TreeView from "react-accessible-treeview";
import cx from "classnames";

// TODO: select root folder via other explorer selection
const initialData = [
  {
    name: "",
    id: 0,
    children: [1],
    parent: null,
    fullpath: ""
  },
  {
    name: "tmp",
    children: [],
    id: 1,
    parent: 0,
    isBranch: true,
    fullpath: "/tmp"
  }
];

function MultiSelectCheckboxAsync() {
  const loadedAlertElement = useRef(null);
  const [data, setData] = useState(initialData);
  const [nodesAlreadyLoaded, setNodesAlreadyLoaded] = useState([]);

  const updateTreeData = (list, id, children) => {
    const data = list.map((node) => {
      if (node.id === id) {
        node.children = children.map((el) => {
          return el.id;
        });
      }
      return node;
    });
    return data.concat(children);
  };

  const onLoadData = ({ element }) => {
    if (element.children.length > 0) {
      return Promise.resolve();
    }

    return window.electronAPI.readdir(element.fullpath, { fullpath: true }).then(files => {
      const newChildren = files.map((file, i) => ({
        name: file,
        children: [],
        id: element.id + '-' + i,
        parent: element.id,
        isBranch: false,
        fullpath: element.fullpath + '/' + file
      }));

      setData(value => updateTreeData(value, element.id, newChildren));
    });
  };

  const wrappedOnLoadData = async (props) => {
    const nodeHasNoChildData = props.element.children.length === 0;
    const nodeHasAlreadyBeenLoaded = nodesAlreadyLoaded.find(
      (e) => e.id === props.element.id
    );

    await onLoadData(props);

    if (nodeHasNoChildData && !nodeHasAlreadyBeenLoaded) {
      const el = loadedAlertElement.current;
      setNodesAlreadyLoaded([...nodesAlreadyLoaded, props.element]);
      el && (el.innerHTML = `${props.element.name} loaded`);

      // Clearing aria-live region so loaded node alerts no longer appear in DOM
      setTimeout(() => {
        el && (el.innerHTML = "");
      }, 5000);
    }
  };

  return (
    <>
      <div>
        <TreeView
          data={data}
          aria-label="Checkbox tree"
          onLoadData={wrappedOnLoadData}
          multiSelect
          propagateSelect
          togglableSelect
          propagateSelectUpwards
          nodeRenderer={({
            element,
            isBranch,
            isExpanded,
            isSelected,
            isHalfSelected,
            getNodeProps,
            level,
            handleSelect,
            handleExpand,
          }) => {
            const branchNode = (isExpanded, element) => {
              return isExpanded && element.children.length === 0 ? (
                <>
                  <span
                    role="alert"
                    aria-live="assertive"
                    className="visually-hidden"
                  >
                    loading {element.name}
                  </span>
                  <AiOutlineLoading
                    aria-hidden={true}
                    className="loading-icon"
                  />
                </>
              ) : (
                <ArrowIcon isOpen={isExpanded} />
              );
            };
            return (
              <div
                {...getNodeProps({ onClick: handleExpand })}
                style={{ marginLeft: 40 * (level - 1) }}
              >
                {isBranch && branchNode(isExpanded, element)}
                <span className="name" onClick={(e) => {
                  console.log('clicked' + element.fullpath)
                  e.stopPropagation();
              }}>{element.name}</span>
              </div>
            );
          }}
        />
      </div>
    </>
  );
}

const ArrowIcon = ({ isOpen, className }) => {
  const baseClass = "arrow";
  const classes = cx(
    baseClass,
    { [`${baseClass}--closed`]: !isOpen },
    { [`${baseClass}--open`]: isOpen },
    className
  );
  return <IoMdArrowDropright className={classes} />;
};

function Main() {
  return (
    <div className="min-h-screen prose">
      <div>
        <MultiSelectCheckboxAsync />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Main />} />
      </Routes>
    </Router>
  );
}
