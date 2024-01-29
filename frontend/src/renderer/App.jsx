import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { IoMdArrowDropright } from 'react-icons/io';
import { IoMdArrowDropdown } from 'react-icons/io';
import TreeView from 'react-accessible-treeview';
import { Highlight, themes } from 'prism-react-renderer';
import {
  useQuery,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';

// TODO: select root folder via other explorer selection
const initialData = [
  {
    name: '',
    id: 0,
    children: [1],
    parent: null,
    fullpath: '',
  },
  {
    name: 'FuzzSight',
    children: [],
    id: 1,
    parent: 0,
    isBranch: true,
    fullpath: '/home/user/P/FuzzSight',
  },
];

const queryClient = new QueryClient();

function MultiSelectCheckboxAsync({ setSelectedFile }) {
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

    return window.electronAPI
      .readdir(element.fullpath, { fullpath: true, withFileTypes: true })
      .then((files) => {
        console.log(files);
        const newChildren = files.map((file, i) => ({
          name: file.name,
          children: [],
          id: element.id + '-' + i,
          parent: element.id,
          isBranch: file.isFolder,
          fullpath: element.fullpath + '/' + file.name,
        }));

        setData((value) => updateTreeData(value, element.id, newChildren));
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
        el && (el.innerHTML = '');
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
            return (
              <div
                {...getNodeProps({ onClick: handleExpand })}
                style={{ marginLeft: 40 * (level - 1) }}
                className="flex hover:bg-gray-300"
              >
                {element.isBranch && (
                  <div className="flex-none flex items-center justify-center">
                    {isExpanded ? (
                      <IoMdArrowDropdown />
                    ) : (
                      <IoMdArrowDropright />
                    )}
                  </div>
                )}
                <div
                  className="whitespace-nowrap select-none w-full"
                  onClick={(e) => {
                    console.log('clicked' + element.fullpath);

                    setSelectedFile({
                      path: element.fullpath,
                      isFolder: element.isBranch,
                    });

                    if (element.isBranch) {
                      return;
                    }

                    e.stopPropagation();
                  }}
                >
                  {element.name}
                </div>
              </div>
            );
          }}
        />
      </div>
    </>
  );
}

function Sidebar({ setSelectedFile }) {
  const [width, setWidth] = useState(280);
  const isResized = useRef(false);

  useEffect(() => {
    window.addEventListener('mousemove', (e) => {
      if (!isResized.current) {
        return;
      }
      setWidth((prevWidth) => prevWidth + e.movementX);
    });
    window.addEventListener('mouseup', () => {
      isResized.current = false;
    });
  }, []);

  return (
    <div className="flex min-h-screen">
      <div style={{ width: `${width / 16}rem` }} className="overflow-hidden">
        <MultiSelectCheckboxAsync setSelectedFile={setSelectedFile} />
      </div>
      <div
        className="w-2 cursor-col-resize bg-gray-300"
        onMouseDown={() => (isResized.current = true)}
      />
    </div>
  );
}

function CoverageTable({ fileData }) {
  return (
    <table className="w-full text-left text-gray-500 table-fixed">
      <tr>
        <th scope="col" className="px-6 py-3">
          Filename
        </th>
        <th scope="col" className="px-6 py-3 text-center w-[150px]">
          Covered
        </th>
        <th scope="col" className="px-6 py-3 text-center w-[150px]">
          Uncovered
        </th>
      </tr>
      <tbody>
        {fileData.map((f) => {
          const [filename, coveredLines, uncoveredLines] = f;
          return (
            <tr className="border-b hover:bg-gray-50">
              <th
                scope="row"
                className="px-4 py-2 relative font-medium text-gray-900 whitespace-nowrap"
              >
                <div class="group relative">
                  <div className="overflow-x-hidden">{filename}</div>
                  <div class="absolute inset-0 flex opacity-0 group-hover:opacity-100 bg-gray-50 bg-opacity-100 w-screen">
                    {filename}
                  </div>
                </div>
              </th>
              <th
                scope="row"
                className="px-4 py-2 font-medium text-gray-900 whitespace-nowrap text-center"
              >
                {coveredLines}
              </th>
              <th
                scope="row"
                className="px-4 py-2 font-medium text-gray-900 whitespace-nowrap text-center"
              >
                {uncoveredLines}
              </th>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function CoverageOverview({ selectedFolder }) {
  // fileCoverage[0] are selected files, [1] are unselected
  const [fileCoverage, setFileCoverage] = useState({
    selected: [],
    unselected: [],
  });

  const coverageOverviewQueryParams = new URLSearchParams({
    path: selectedFolder,
  });

  useQuery({
    queryKey: ['coverageOverview'],
    queryFn: async () => {
      const response = await fetch(
        `http://localhost:7156/coverageOverview?${coverageOverviewQueryParams}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch /coverageOverview');
      }
      const receivedCoverageOverview = await response.json();
      setFileCoverage(receivedCoverageOverview);
      return receivedCoverageOverview;
    },
    refetchInterval: 2000,
  });

  return (
    <div className="space-y-10">
      <div>
        <div className="text-xl font-bold whitespace-nowrap text-gray-900 px-3 py-1">
          Files in {selectedFolder}
        </div>
        <CoverageTable fileData={fileCoverage.selected} />
      </div>
      <div>
        <div className="text-xl font-bold whitespace-nowrap text-gray-900 px-3 py-1">
          Other Files
        </div>
        <CoverageTable fileData={fileCoverage.unselected} />
      </div>
    </div>
  );
}

function CodePanel({ selectedFile }) {
  const [code, setCode] = useState('');
  const [lineCoverCode, setLineCoverCode] = useState([]);

  const coveredLinesQueryParams = new URLSearchParams({
    path: selectedFile,
  });

  useQuery({
    queryKey: ['coveredLines'],
    queryFn: async () => {
      const response = await fetch(
        `http://localhost:7156/coveredLines?${coveredLinesQueryParams}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch /coveredLines');
      }
      const receivedCoveredLines = await response.json();
      setLineCoverCode(receivedCoveredLines);
      return receivedCoveredLines;
    },
    refetchInterval: 2000,
  });

  const getLineCoverCode = (lineNumber) => {
    if (lineNumber > lineCoverCode.length) {
      console.warn('getLineCoverCode lineNumber out of range ' + lineNumber);
      return false;
    }
    return lineCoverCode[lineNumber];
  };

  useEffect(() => {
    if (!selectedFile) return;

    window.electronAPI.readFileSync(selectedFile).then((content) => {
      console.log(content);
      // todo split by line?
      setCode(content);
    });
  }, [selectedFile]);

  return (
    <div className="pl-1 w-full">
      <div className="text-xl tracking-tight text-gray-900 border-b mb-3 pl-1">
        {selectedFile ? selectedFile : ''}
      </div>
      <Highlight theme={themes.oneDark} language="cpp" code={code}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre style={style} className="flex w-full">
            <div>
              {tokens.map((line, i) => (
                <div
                  key={i}
                  {...getLineProps({ line })}
                  className="bg-white text-right"
                >
                  <div className="pr-2">{i + 1}</div>
                </div>
              ))}
            </div>
            <div className="w-full">
              {tokens.map((line, i) => {
                let bgColor;
                switch (getLineCoverCode(i + 1)) {
                  case 0:
                    // Coverage Unknown
                    bgColor = 'bg-white';
                    break;
                  case 1:
                    // Covered
                    bgColor = 'bg-green-100';
                    break;
                  case 2:
                    // Not Covered
                    bgColor = 'bg-red-100';
                    break;
                  default:
                    bgColor = 'bg-white';
                }

                return (
                  <div
                    key={i}
                    {...getLineProps({ line })}
                    className={`flex ${bgColor}`}
                  >
                    {line.map((token, key) => (
                      <div key={key} {...getTokenProps({ token })} />
                    ))}
                  </div>
                );
              })}
            </div>
          </pre>
        )}
      </Highlight>
    </div>
  );
}

function Main() {
  // TODO: change def sel file to null
  const [selectedFile, setSelectedFile] = useState({
    path: '/home/user/P/FuzzSight',
    isFolder: true,
    // path: '/home/user/P/FuzzSight/test/main.cpp',
    // isFolder: false,
  });

  return (
    <div className="min-h-screen w-full min-w-full prose flex">
      <Sidebar setSelectedFile={setSelectedFile} />
      {selectedFile.isFolder ? (
        <CoverageOverview selectedFolder={selectedFile.path} />
      ) : (
        <CodePanel selectedFile={selectedFile.path} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route path="/" element={<Main />} />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}
